#!/usr/bin/env python3
"""One authenticated Bet365 FI request; stream raw response to read-only TS parser.

Neither token nor provider response is written to disk.
"""
import getpass
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request

def main():
    if len(sys.argv) != 3 or not re.fullmatch(r"[0-9]{1,16}", sys.argv[1]) or sys.argv[2] not in ("live", "upcoming"):
        raise SystemExit("Usage: python3 scripts/betsapi-market-coverage.py FI live|upcoming")
    fi, mode = sys.argv[1:]
    token = getpass.getpass("BetsAPI token (hidden): ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{12,180}", token):
        raise SystemExit("INVALID_TOKEN")
    route = "/v1/bet365/event" if mode == "live" else "/v4/bet365/prematch"
    url = "https://api.b365api.com" + route + "?" + urllib.parse.urlencode({"FI": fi, "token": token})
    try:
        with urllib.request.urlopen(url, timeout=35) as response:
            raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise ValueError("RESPONSE_TOO_LARGE")
        payload = json.loads(raw)
        if str(payload.get("success")) != "1" or not isinstance(payload.get("results"), list):
            raise ValueError("PROVIDER_RESPONSE_INVALID")
        result = subprocess.run(
            ["node", "--import", "tsx", "scripts/betsapi-market-coverage.mts", fi, mode],
            input=json.dumps(payload), text=True, timeout=30, check=False)
        return result.returncode
    except Exception as error:
        print("READ_ONLY_PROBE_FAILED:", type(error).__name__, file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
