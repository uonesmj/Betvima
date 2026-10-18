#!/usr/bin/env python3
"""One bounded, read-only live bookmaker smoke test against the project's TS parser.

Enter API token once. Never logs token, raw payload, or writes any file.
Maximum 1 discovery plus 8 fixture calls. Never places or settles a wager.
"""
import getpass
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request

BASE = "https://api.b365api.com"
MAX_BYTES = 5_000_000

def fetch(path, token, params, timeout):
    query = urllib.parse.urlencode({**params, "token": token})
    request = urllib.request.Request(BASE + path + "?" + query, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("RESPONSE_TOO_LARGE")
    result = json.loads(raw)
    if str(result.get("success")) != "1" or not isinstance(result.get("results"), list):
        raise ValueError("INVALID_PROVIDER_RESPONSE")
    return result

def walk(node):
    if isinstance(node, list):
        for value in node:
            yield from walk(value)
    elif isinstance(node, dict):
        if node.get("type") in ("MG", "MA", "PA"):
            yield node
        else:
            for value in node.values():
                yield from walk(value)

def valid_price(value):
    text = str(value or "").strip()
    fraction = re.fullmatch(r"(\d{1,7})/(\d{1,7})", text)
    if fraction:
        numerator, denominator = map(int, fraction.groups())
        return denominator > 0 and 1.01 <= 1 + numerator / denominator <= 1000
    if re.fullmatch(r"\d{1,4}(?:\.\d{1,4})?", text):
        return 1.01 <= float(text) <= 1000
    return False

def main():
    token = getpass.getpass("BetsAPI token (hidden): ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{12,180}", token):
        return 2
    try:
        rows = fetch("/v1/bet365/inplay_filter", token, {"sport_id": 1}, 35)["results"]
        fis = list(dict.fromkeys(str(x.get("id")) for x in rows if isinstance(x, dict)
                                 and re.fullmatch(r"\d{1,16}", str(x.get("id", "")))))
        print(f"Live fixtures discovered: {len(fis)}; scanning max 8", flush=True)
        for fi in fis[:8]:
            try:
                payload = fetch("/v1/bet365/event", token, {"FI": fi}, 25)
            except Exception as error:
                print(f"FI {fi}: provider unavailable ({type(error).__name__})", flush=True)
                continue
            pa = [r for r in walk(payload["results"]) if r.get("type") == "PA"]
            valid = [r for r in pa if valid_price(r.get("OD"))]
            open_valid = [r for r in valid if str(r.get("SU", "0")) == "0"]
            print(f"FI {fi}: raw PA={len(pa)}, priced={len(valid)}, open-priced={len(open_valid)}", flush=True)
            if len(open_valid) < 2:
                continue
            output = subprocess.run(
                ["node", "--import", "tsx", "scripts/betsapi-market-coverage.mts", fi, "live"],
                input=json.dumps(payload), text=True, capture_output=True, timeout=30,
                check=False,
            )
            if output.returncode:
                print("PARSER_FAILED: " + output.stderr.strip()[:300], flush=True)
                return 3
            summary = json.loads(output.stdout)
            print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
            if summary.get("openPricedSelections", 0) < 2:
                print("BLOCKED: valid upstream odds not represented as open catalogue selections")
                return 4
            print("READ_ONLY_LIVE_CATALOGUE_PASS; wagering and settlement remain DISABLED")
            return 0
        print("INCONCLUSIVE: no open-priced fixture among first 8; no wager enabled")
        return 5
    except Exception as error:
        print("PROBE_FAILED: " + type(error).__name__, file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
