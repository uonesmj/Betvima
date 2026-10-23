#!/usr/bin/env python3
"""Audit native Android UI strings and locale coverage. Read-only scan.

Never translate provider/team names, amounts, odds, identifiers or user-entered text.
"""
import json, re, pathlib, collections
ROOT = pathlib.Path(__file__).resolve().parents[1] / "android-native" / "app" / "src" / "main" / "java" / "com" / "betvima" / "app" / "ui"
QUOTED = r'"((?:\\.|[^"\\])*)"'
TRANS = re.compile(r'\b(?:tr|trLive177|label87|infoText|tr87|labelFor|localized)\(\s*[^,()]*,\s*' + QUOTED + r'\s*,')
DIRECT = re.compile(r'\bText\(\s*(?:(?:text|value)\s*=\s*)?' + QUOTED)
KEY = re.compile(QUOTED + r'\s+to\s+')
latin = re.compile(r'[A-Za-z]{2}')
FILES = sorted(ROOT.rglob("*.kt"))
def unescape(x):
    return x.replace(r'\$', '$').replace(r'\n', '\n').replace(r'\"', '"')
results = {}
for f in FILES:
    s=f.read_text(encoding='utf-8')
    results[f.name]={
        "tr": sorted(set(unescape(m.group(1)) for m in TRANS.finditer(s) if latin.search(m.group(1)))),
        "direct": sorted(set(unescape(m.group(1)) for m in DIRECT.finditer(s) if latin.search(m.group(1)))),
    }
turkish=set(unescape(m.group(1)) for m in KEY.finditer((ROOT/"TurkishTranslations169.kt").read_text()))
armenian=set(unescape(m.group(1)) for m in KEY.finditer((ROOT/"Armenian172.kt").read_text()))
arabic=set()
for f in ROOT.glob("ArabicTranslations175*.kt"):
    arabic |= set(unescape(m.group(1)) for m in KEY.finditer(f.read_text()))
for f in (ROOT / "NativeTranslations176").glob("NativeTr176Part*.kt"):
    turkish |= set(unescape(m.group(1)) for m in KEY.finditer(f.read_text(encoding="utf-8")))
for f in (ROOT / "NativeTranslations176").glob("NativeHy176Part*.kt"):
    armenian |= set(unescape(m.group(1)) for m in KEY.finditer(f.read_text(encoding="utf-8")))
for f in (ROOT / "NativeTranslations176").glob("NativeAr176Part*.kt"):
    arabic |= set(unescape(m.group(1)) for m in KEY.finditer(f.read_text(encoding="utf-8")))
reviewed=set(unescape(m.group(1)) for m in KEY.finditer((ROOT/"NativeQuality176.kt").read_text(encoding="utf-8")))
turkish |= reviewed
armenian |= reviewed
arabic |= reviewed
live_reviewed=set(unescape(m.group(1)) for m in KEY.finditer(
    (ROOT/"NativeLiveTranslations177.kt").read_text(encoding="utf-8")))
turkish |= live_reviewed
armenian |= live_reviewed
arabic |= live_reviewed
all_keys={k for r in results.values() for k in r["tr"]}
all_direct={k for r in results.values() for k in r["direct"]}
out={
    "summary":{
        "source_files":len(FILES),
        "tr_keys":len(all_keys),
        "direct_strings":len(all_direct),
        "turkish_keys":len(turkish),
        "armenian_keys":len(armenian),
        "arabic_keys":len(arabic),
        "missing_tr":len(all_keys-turkish),
        "missing_hy":len(all_keys-armenian),
        "missing_ar":len(all_keys-arabic)
    },
    "missing":{
        "tr":sorted(all_keys-turkish),
        "hy":sorted(all_keys-armenian),
        "ar":sorted(all_keys-arabic)
    },
    "direct_strings":sorted(all_direct),
    "file_strings":results
}
path=pathlib.Path("native-localization-audit.json")
path.write_text(json.dumps(out, ensure_ascii=False, indent=2),encoding="utf-8")
print(json.dumps(out["summary"], ensure_ascii=False, indent=2))
print("Wrote",path)
if "--fail-on-gaps" in __import__("sys").argv and any(out["missing"][l] for l in ("tr","hy","ar")):
    print(json.dumps(out["missing"], ensure_ascii=False, indent=2))
    raise SystemExit("Incomplete native translations")

# The six previously bilingual live-match screens must not bypass TR/HY/AR.
LIVE_SCREENS = (
    "LiveIncidentCue129.kt", "LiveIncidentPitch129.kt",
    "LiveMatchActivityPanel.kt", "PremiumFloatingViews130.kt",
    "PremiumMatchScoreHeader126.kt", "PremiumMatchTvModal126.kt",
    "PremiumNativeLiveTracker.kt"
)
stale = []
for name in LIVE_SCREENS:
    code = (ROOT / name).read_text(encoding="utf-8")
    if re.search(r'if\s*\(\s*fa\s*\)\s*"[^"]+"\s*else\s*"[^"]+"', code):
        stale.append(name)
print("Live screen binary-language fallbacks:", stale)
if stale:
    raise SystemExit("Some live screens still force English outside Persian")
