#!/usr/bin/env python3
"""Bundle freely licensed CC0 cryptocurrency icon artwork into the debug APK."""
from pathlib import Path
from urllib.request import Request, urlopen
import time

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "app" / "src" / "main" / "res" / "drawable-nodpi"
ASSETS = ("btc", "eth", "sol", "xrp", "bnb", "doge", "ada", "trx", "usdt")
BASE_URL = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/"
DEST.mkdir(parents=True, exist_ok=True)

for symbol in ASSETS:
    out = DEST / ("crypto_" + symbol + ".png")
    remote = BASE_URL + symbol + ".png"
    for attempt in range(3):
        try:
            req = Request(remote, headers={"User-Agent": "CFCoin-Android-CI/0.3"})
            with urlopen(req, timeout=20) as response:
                content = response.read(160_000)
            if not content.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Invalid PNG file for " + symbol)
            out.write_bytes(content)
            print("Bundled verified PNG:", symbol, len(content), "bytes")
            break
        except Exception as exc:
            if attempt == 2:
                raise SystemExit("Failed to obtain required cryptocurrency icon " + symbol + ": " + str(exc))
            time.sleep(attempt + 1)

print("All " + str(len(ASSETS)) + " authentic coin logos bundled.")
