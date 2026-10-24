#!/usr/bin/env python3
"""Compile Russian Latin translations for BetVima native Android.

The input consists ONLY of app-authored, static source string literals. Never
send personally identifiable info, server responses or payment credentials.
Translation runs in CI, not on a customer's phone. Brand names,
credentials, runtime balances, game titles, IDs and quotes are never sent.
"""
import concurrent.futures
import json
import pathlib
import random
import re
import sys
import threading
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UI = ROOT / "android-native/app/src/main/java/com/betvima/app/ui"
OUT = UI / "Russian180"
FOOTER_SOURCE = UI / "FooterInformationContent.kt"
SUMMARY = ROOT / "russian-180-translation-audit.json"
TOKEN = re.compile(
    r'\$\{[^}]+\}|\$[a-zA-Z_][a-zA-Z_0-9]*|'
    r'https?://[^\s)]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|'
    r'\b(?:BetVima|Cloudflare|Supabase|Google Authenticator|HotVoucher|'
    r'U-Voucher|NOWPayments|Android|USDT|USDC|USD|IRR|PIN|OTP|2FA|QR|'
    r'API|VIP|HTTP|JPG|PNG|WEBP|PDF|HTTPS|KYC)\b', re.I)
QUOTED = r'"((?:\\.|[^"\\])*)"'
MAPPINGS = re.compile(QUOTED+r'\s+to\s+')
TRANS = re.compile(r'\b(?:tr|trLive177|infoText|label87|tr87|labelFor)\(\s*[^,()]*,\s*'+QUOTED+r'\s*,')
DIRECT = re.compile(r'\bText\(\s*(?:(?:text|value)\s*=\s*)?'+QUOTED)
LATIN = re.compile(r'[a-zA-Z]{2,}')
PLACEHOLDER = re.compile(r'RUKEEP(\d{3})AZ')
KOTLIN_KEY_RE = re.compile(r'^\s*"((?:\\.|[^"\\])*)"\s+to\s+"((?:\\.|[^"\\])*)"')
SOURCE_NAMES = (
    "TurkishTranslations169.kt", "Armenian172.kt",
    "NativeQuality176.kt", "NativeLiveTranslations177.kt",
    "NativeScreenshot178.kt", "AzerbaijaniQuality179.kt", "AzerbaijaniMarket179.kt",
)
SKIP = {"EN","FA","TR","DARI","HY","AR","RU","USD","IRR","BetVima"}
LOCK = threading.Lock()

def unescape(s):
    return s.replace(r'\n', '\n').replace(r'\$', '$').replace(r'\"', '"')

def kotlin(s):
    return json.dumps(s, ensure_ascii=False).replace("$", r"\$")

def collect_source():
    keys=set()
    for name in SOURCE_NAMES:
        source=(UI/name).read_text(encoding="utf-8")
        for m in MAPPINGS.finditer(source):
            key=unescape(m.group(1))
            if LATIN.search(key): keys.add(key)
    for p in (UI/"NativeTranslations176").glob("*.kt"):
        for m in MAPPINGS.finditer(p.read_text(encoding="utf-8")):
            key=unescape(m.group(1))
            if LATIN.search(key): keys.add(key)
    for p in (UI/"Azerbaijani179").glob("Azerbaijani179Part*.kt"):
        for m in MAPPINGS.finditer(p.read_text(encoding="utf-8")):
            key=unescape(m.group(1))
            if LATIN.search(key): keys.add(key)
    for p in UI.glob("ArabicTranslations175*.kt"):
        for m in MAPPINGS.finditer(p.read_text(encoding="utf-8")):
            key=unescape(m.group(1))
            if LATIN.search(key): keys.add(key)
    for p in UI.rglob("*.kt"):
        source=p.read_text(encoding="utf-8")
        for regex in (TRANS,DIRECT):
            for m in regex.finditer(source):
                key=unescape(m.group(1))
                if LATIN.search(key):keys.add(key)
    return keys

def footer_data():
    content=FOOTER_SOURCE.read_text(encoding="utf-8")
    article_heads=re.findall(
        r'"(terms|privacy|responsible|guide)"\s*->\s*FooterInfoArticle\(\s*'
        r'id,\s*"([^"]+)",\s*"[^"]+",\s*"([^"]+)",\s*"[^"]+",\s*'
        r'"([^"]+)",\s*"[^"]+",\s*"https://',
        content, re.S)
    sections=re.findall(
        r'section\(\s*"([^"]+)",\s*"[^"]+",\s*"""(.*?)"""\s*,\s*"""',
        content, re.S)
    assert len(article_heads)==4,(len(article_heads),article_heads)
    assert len(sections)==42,(len(sections),sections[:3])
    return article_heads,[(name,body.strip()) for name,body in sections]

def mask(s):
    words=[]
    def replace(m):
        words.append(m.group(0))
        return f"RUKEEP{len(words)-1:03d}AZ"
    return TOKEN.sub(replace,s),words

def restore(s,values):
    s=re.sub(r'AZ\s*KEEP\s*(\d{3})\s*AZ',r'RUKEEP\1AZ',s,flags=re.I)
    nums=sorted(set(int(x) for x in PLACEHOLDER.findall(s)))
    if nums!=list(range(len(values))):return None
    for i,x in enumerate(values):s=s.replace(f"RUKEEP{i:03d}AZ",x)
    return s

def translate_one(task):
    kind,key=task
    if not key.strip() or not LATIN.search(key):return (kind,key,key,None)
    if key in SKIP or (not re.search(r'[A-Z]', key) and
                       re.fullmatch(r'[a-z_0-9./-]{2,30}',key)):
        return (kind,key,key,None)
    masked,tokens=mask(key)
    error=None
    for attempt in range(6):
        try:
            url=("https://translate.googleapis.com/translate_a/single?"+
                 urllib.parse.urlencode(dict(client="gtx",sl="en",tl="ru",
                                             dt="t",q=masked)))
            req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req,timeout=18) as resp:
                segments=json.loads(resp.read().decode("utf-8"))[0]
            value="".join((segment[0] or "") for segment in segments)
            value=restore(value,tokens)
            if not value or not value.strip():
                raise ValueError("lost protected variables")
            if key.count("\n") and not value.count("\n"):
                # Keep paragraph boundaries when Google normalizes whitespace.
                if key.count("\n")<=2 and kind=="ui":
                    value=value.replace(" ", "\n", 1)
            return (kind,key,value,None)
        except Exception as e:
            error=f"{type(e).__name__}: {e}"
            time.sleep(min(10, 0.8*2**attempt)+random.random()*0.3)
    return (kind,key,None,error)

def write_chunks(entries, max_chunk=110):
    OUT.mkdir(parents=True,exist_ok=True)
    chunks=[]
    for i in range(0,len(entries),max_chunk):
        part=entries[i:i+max_chunk]
        name=f"Russian180Part{1+i//max_chunk}"
        code = ("package com.betvima.app.ui\n\ninternal object "+name+
                " {\n    val terms: Map<String, String> = mapOf(\n"+
                ",\n".join("        "+kotlin(k)+" to "+kotlin(v) for k,v in part)+
                "\n    )\n}\n")
        (OUT/(name+".kt")).write_text(code,encoding="utf-8")
        chunks.append(name)
    code=("package com.betvima.app.ui\n\n"
          "/** Static Russian translations; no runtime network calls. */\n"
          "internal object RussianTranslations180 {\n"
          "    val terms: Map<String, String> = " +
          (" +\n        ".join(c+".terms" for c in chunks) if chunks else "emptyMap()") +
          "\n    fun translate(key: String): String = terms[key] ?: key\n"
          "    fun hasTranslation(key: String): Boolean = key in terms\n}\n")
    (OUT/"RussianTranslations180.kt").write_text(code,encoding="utf-8")

def make_footer(meta,sections,results):
    metadata=[]
    for id,title,subtitle,summary in meta:
        metadata.append((id,results[("footer",title)],
                         results[("footer",subtitle)],results[("footer",summary)]))
    pairs=[(heading,results[("footer",heading)],results[("footer",body)])
           for heading,body in sections]
    # Keep dictionaries shallow to avoid Kotlin JVM constant-pool limits.
    split=14
    names=[]
    for n in range(0,len(pairs),split):
        name=f"RussianFooter180Part{1+n//split}"
        part=pairs[n:n+split]
        src=("package com.betvima.app.ui\n\ninternal object "+name+
             " {\n    val sections: Map<String, Pair<String, String>> = mapOf(\n"+
             ",\n".join("        "+kotlin(k)+" to ("+kotlin(h)+" to "+kotlin(b)+")"
                         for k,h,b in part)+
             "\n    )\n}\n")
        (OUT/(name+".kt")).write_text(src,encoding="utf-8")
        names.append(name)
    src=("package com.betvima.app.ui\n\n"
        "/** Translated informational articles retain their canonical official links. */\n"
        "internal object RussianFooter180 {\n"
        "    private val metadata: Map<String, Triple<String, String, String>> = mapOf(\n"+
        ",\n".join("        "+kotlin(i)+" to Triple("+kotlin(t)+", "+
                    kotlin(sub)+", "+kotlin(sm)+")" for i,t,sub,sm in metadata)+
        "\n    )\n"
        "    private val sections: Map<String, Pair<String, String>> = "+
        (" +\n        ".join(n+".sections" for n in names) if names else "emptyMap()")+
        "\n    fun article(lang: Lang, article: FooterInfoArticle, field: String): String? {\n"
        "        if (lang != Lang.RU) return null\n"
        "        val row = metadata[article.id] ?: return null\n"
        "        return when (field) {\n"
        "            \"title\" -> row.first\n"
        "            \"subtitle\" -> row.second\n"
        "            \"summary\" -> row.third\n"
        "            else -> null\n        }\n    }\n"
        "    fun section(lang: Lang, section: FooterInfoSection, heading: Boolean): String? {\n"
        "        if (lang != Lang.RU) return null\n"
        "        val row = sections[section.headingEn] ?: return null\n"
        "        return if (heading) row.first else row.second\n    }\n"
        "    fun hasSection(heading: String): Boolean = heading in sections\n"
        "}\n")
    (OUT/"RussianFooter180.kt").write_text(src,encoding="utf-8")

def main():
    keys=collect_source()
    meta,sections=footer_data()
    legal={text for id,title,subtitle,summary in meta for text in (title,subtitle,summary)}
    legal |= {text for head,body in sections for text in (head,body)}
    tasks=[("ui",k) for k in keys]+[("footer",k) for k in legal]
    print("RU key inventory:",len(keys),"footer fields:",len(legal),
          "total:",len(tasks),flush=True)
    records={}
    errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures=[pool.submit(translate_one,t) for t in tasks]
        for idx,f in enumerate(concurrent.futures.as_completed(futures),1):
            kind,key,value,error=f.result()
            if error:errors.append((kind,key,error))
            else:records[(kind,key)]=value
            if idx%100==0 or idx==len(tasks):
                print("RU translated",idx,"/",len(tasks),"errors",len(errors),flush=True)
    if errors:
        (ROOT/"russian180-errors.json").write_text(
            json.dumps(errors,ensure_ascii=False,indent=2),encoding="utf-8")
        print("Translation errors",json.dumps(errors[:15],ensure_ascii=False),flush=True)
        sys.exit(1)
    write_chunks(sorted((k,records[("ui",k)]) for k in keys))
    make_footer(meta,sections,records)
    report={
      "ui_keys":len(keys),"footer_articles":len(meta),
      "footer_sections":len(sections),"untranslated_requests":len(errors),
      "identical_english":sorted(k for k in keys
         if records[("ui",k)].casefold().strip()==k.casefold().strip()
         and LATIN.search(k))
    }
    SUMMARY.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v if k!="identical_english" else len(v)
           for k,v in report.items()}),flush=True)

if __name__=="__main__":
    main()
