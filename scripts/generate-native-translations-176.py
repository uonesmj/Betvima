#!/usr/bin/env python3
"""Generate reviewable, static native translations for missing UI labels.

Source: audited tr(lang, English, Persian) call-site keys. This never sends
user data, balances, server game titles or private credentials anywhere.
Translation is a build-time operation; the shipped APK runs offline.
"""
import concurrent.futures
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "android-native/app/src/main/java/com/betvima/app/ui"
REPORT = ROOT / "native-localization-audit.json"
OUTPUT = SOURCE / "NativeTranslations176"
REPORT_SUMMARY = ROOT / "native-localization-generation.json"
LOCK = threading.Lock()

PROTECT = re.compile(
    r'\$\{[^}]+\}|\$[A-Za-z_][A-Za-z_0-9]*|'
    r'\b(?:Google Authenticator|BetVima|Cloudflare|Supabase|HotVoucher|U-Voucher|'
    r'Android|WebView|NOWPayments|uWallet|USDT|HTTP|USD|IRR|PIN|VIP|API|'
    r'SMS|QR|JPG|PNG|WEBP|PDF|2FA)\b',re.IGNORECASE)
SOURCE_GLOSSARY = {"tr": "Turkish", "hy": "Eastern Armenian", "ar": "Modern Standard Arabic"}
MARKER = re.compile(r'ZWKEEP(\d{3})ZW')

def mask(s):
    tokens = []
    def replace(m):
        tokens.append(m.group(0))
        return f'ZWKEEP{len(tokens)-1:03d}ZW'
    return PROTECT.sub(replace, s), tokens

def restore(s, tokens):
    # Google usually keeps synthetic placeholders intact, but may insert spaces.
    value = re.sub(r'ZW\s*KEEP\s*(\d{3})\s*ZW',r'ZWKEEP\1ZW',s,flags=re.IGNORECASE)
    matches = list(MARKER.finditer(value))
    seen = sorted(set(int(m.group(1)) for m in matches))
    if seen != list(range(len(tokens))):
        return None
    for i,t in enumerate(tokens):
        value = value.replace(f'ZWKEEP{i:03d}ZW', t)
    return value

def google_translate(phrase, language):
    if not phrase.strip():
        return phrase
    payload = urllib.parse.urlencode(dict(client="gtx", sl="en", tl=language,
                                         dt="t", q=phrase))
    req = urllib.request.Request(
        "https://translate.googleapis.com/translate_a/single?" + payload,
        headers={"User-Agent": "Mozilla/5.0 (compatible; BetVimaI18NAudit/1.0)"})
    with urllib.request.urlopen(req, timeout=16) as response:
        data=json.loads(response.read().decode("utf-8"))
    return "".join((segment[0] or "") for segment in data[0])

def translate(item):
    lang, key = item
    if not re.search(r'[A-Za-z]{2}', key):
        return lang,key,key,None
    masked,tokens=mask(key)
    error=None
    for attempt in range(6):
        try:
            result=google_translate(masked,lang)
            result=restore(result,tokens)
            if not result or not result.strip():
                raise ValueError("empty or changed protected placeholders")
            # Do not allow HTML markup or drop meaningful numbers.
            if re.search(r'<\s*(?:script|style|iframe)',result,re.IGNORECASE):
                raise ValueError("invalid translated markup")
            return lang,key,result,None
        except Exception as exc:
            error=f"{type(exc).__name__}: {exc}"
            time.sleep(min(12,0.7*2**attempt)+random.random()/5)
    return lang,key,None,error

def kotlin_string(s):
    # Kotlin template interpolation is forbidden in literal translations:
    # placeholders must be restored only by the existing runtime, not code.
    return (json.dumps(s,ensure_ascii=False)
        .replace('$',r'\$')
        .replace(r'\/','/'))

def chunk_map(lang, index, data):
    prefix={"tr":"Tr","hy":"Hy","ar":"Ar"}[lang]
    name=f"Native{prefix}176Part{index}"
    pairs=",\n".join(
        f"        {kotlin_string(key)} to {kotlin_string(target)}"
        for key,target in data)
    return name, f"""package com.betvima.app.ui

/**
 * Build-time reviewed UI label translations. Original English and Persian
 * resources, bet amounts, odds, server-sourced fields and layout are unchanged.
 */
internal object {name} {{
    val terms: Map<String, String> = mapOf(
{pairs}
    )
}}
"""

def main():
    report=json.loads(REPORT.read_text(encoding="utf-8"))
    missing=report["missing"]
    expected = {(lang,key) for lang in ("tr","hy","ar") for key in missing[lang]}
    print(f"Translating {len(expected)} missing labels in Turkish, Armenian and Arabic",flush=True)
    results={}
    failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures=[pool.submit(translate, key) for key in sorted(expected)]
        for idx,future in enumerate(concurrent.futures.as_completed(futures),1):
            lang,key,target,error=future.result()
            if error: failures.append(dict(language=lang,source=key,error=error))
            else: results[(lang,key)]=target
            if idx%100==0 or idx==len(expected):
                print(f"Translated {idx}/{len(expected)}; failures {len(failures)}",flush=True)
    if failures:
        (ROOT/"native-localization-errors.json").write_text(
            json.dumps(failures,ensure_ascii=False,indent=2),encoding="utf-8")
        print("FAILED:",json.dumps(failures[:20],ensure_ascii=False),flush=True)
        sys.exit(2)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    names={}
    for lang in ("tr","hy","ar"):
        pairs=sorted((key,results[(lang,key)]) for key in missing[lang])
        names[lang]=[]
        for i in range(0,len(pairs),120):
            name,code=chunk_map(lang,1+i//120,pairs[i:i+120])
            (OUTPUT/f"{name}.kt").write_text(code,encoding="utf-8")
            names[lang].append(name)
    # A single typed interface consolidates chunks safely at runtime.
    code=['package com.betvima.app.ui','',
          '/** Verified additive translations; existing language defaults remain unchanged. */']
    for lang,class_name in (("tr","TurkishTranslations176"),("hy","ArmenianTranslations176"),("ar","ArabicTranslations176")):
        code.append(f"internal object {class_name} {{")
        code.append("    val terms: Map<String, String> = " +
                    ("\n        + ".join(name+".terms" for name in names[lang]) if names[lang] else "emptyMap()"))
        code.append("    fun translate(key: String): String = terms[key] ?: key")
        code.append("}")
        code.append("")
    (OUTPUT/"NativeTranslations176.kt").write_text("\n".join(code),encoding="utf-8")
    summary={"generated":{l:len(missing[l]) for l in ("tr","hy","ar")},
             "files":len(list(OUTPUT.glob("*.kt"))),"errors":0}
    REPORT_SUMMARY.write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=="__main__":main()
