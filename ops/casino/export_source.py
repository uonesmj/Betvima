#!/usr/bin/env python3
"""Create a source-only handoff ZIP of BetVima's casino integration.

No private runtime config, provider credentials, VPS state, Git objects or
compiled APKs are exported. Read-only: never changes production or databases.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import subprocess
import zipfile

ROOT = pathlib.Path.cwd()
OUTPUT = ROOT / "BetVima-Casino-Source.zip"
MARKER = re.compile(rb"(?i)\bcasino\b|soft.?aggregator|softagg|casino_|casino/|casino-|casino[A-Z]")
RELATED_NAME = re.compile(r"(?i)casino|soft.?aggregator|softagg|aviator|roulette|slot.?game")
SOURCE_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".py", ".sh",
    ".sql", ".kt", ".java", ".xml", ".gradle", ".properties",
    ".json", ".md", ".css", ".scss", ".html", ".yaml", ".yml",
    ".toml", ".txt", ".svg", ".webmanifest",
}
MEDIA_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".ico"}
BASE_FILES = {
    "package.json", "package-lock.json", "tsconfig.json",
    "vitest.config.ts", "next.config.mjs", "middleware.ts",
}
ROOT_PATHS = (
    "src/app/casino/",
    "src/app/api/v1/casino/",
    "src/app/api/webhooks/softaggregator/",
    "src/components/casino/",
    "src/server/providers/softaggregator/",
    "src/server/kyc/",
    "src/app/api/v1/account/kyc/",
    "ops/casino/",
)
DIRECT_FILES = {
    "src/lib/casino-featured.ts",
    "ops/cloudflare/casino-geo-worker.js",
    "ops/cloudflare/softaggregator-callback-worker.js",
}
SKIP_PARTS = {
    ".git", ".next", "node_modules", "dist", "build", ".turbo", ".venv",
    "coverage", "secrets", "credentials", ".ssh", "private",
}
SKIP_SUFFIXES = {
    ".apk", ".aab", ".keystore", ".jks", ".p12", ".pfx",
    ".pem", ".key", ".crt", ".der", ".env", ".sqlite", ".db",
}
SKIP_NAMES = {
    ".env", ".env.local", ".env.production", ".env.development",
    "service-account.json", "google-services.json", "app-release.apk",
}

revision = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], text=True
).strip()
tracked = subprocess.check_output(["git", "ls-files", "-z"]).split(b"\0")
picked: dict[str, bytes] = {}
skipped_large: list[str] = []
skipped_unsafe: list[str] = []
for encoded in tracked:
    if not encoded:
        continue
    name = os.fsdecode(encoded)
    path = pathlib.PurePosixPath(name)
    if (
        path.is_absolute()
        or ".." in path.parts
        or any(part in SKIP_PARTS for part in path.parts)
        or path.name in SKIP_NAMES
        or path.name.startswith(".env")
        or path.suffix.lower() in SKIP_SUFFIXES
        or name.startswith(".git/")
        or name == "ops/casino/export_source.py"
        or name.startswith(".github/workflows/casino-source-export")
    ):
        continue
    item = ROOT / name
    if not item.is_file() or item.is_symlink():
        continue
    size = item.stat().st_size
    if size > 12 * 1024 * 1024:
        if RELATED_NAME.search(name):
            skipped_large.append(name)
        continue
    always = name in BASE_FILES or name in DIRECT_FILES or name.startswith(ROOT_PATHS)
    relevant_path = bool(RELATED_NAME.search(name))
    # Keep the scope to casino functionality, not the entire general application.
    if not always and not relevant_path and (
        not name.startswith((
            "src/", "tests/", "supabase/migrations/",
            "docs/", "ops/android/", "ops/cloudflare/",
            "public/",
        ))
    ):
        continue
    if item.suffix.lower() not in SOURCE_SUFFIXES | MEDIA_SUFFIXES:
        continue
    data = item.read_bytes()
    if item.suffix.lower() in MEDIA_SUFFIXES:
        if not always and not relevant_path:
            continue
    elif not always and not relevant_path and not MARKER.search(data):
        continue
    # Additional hard exclusion for accidentally checked-in private config.
    if "softaggregator-demo.json" in name or "firebase-adminsdk" in name:
        skipped_unsafe.append(name)
        continue
    picked[name] = data

assert len(picked) > 25, "Unexpectedly few casino files in source snapshot"
required = [
    "src/app/casino/page.tsx",
    "src/app/api/v1/casino/launch/route.ts",
    "src/app/api/v1/casino/demo/route.ts",
    "src/app/api/webhooks/softaggregator/route.ts",
    "src/server/providers/softaggregator/client.ts",
    "src/server/providers/softaggregator/wallet.ts",
    "ops/cloudflare/softaggregator-callback-worker.js",
]
assert all(name in picked for name in required), "Missing critical casino source"
sha_manifest = {
    name: hashlib.sha256(value).hexdigest()
    for name, value in sorted(picked.items())
}
manifest = {
    "project": "BetVima",
    "source_repository": "https://github.com/uonesmj/Betvima",
    "source_commit": revision,
    "scope": "Casino integration and files mentioning casino/SoftAggregator",
    "includes": [
        "web frontend and UI",
        "catalogue, demo and live launch API source",
        "SoftAggregator provider and wallet reconciliation source",
        "callback signature code and Cloudflare workers",
        "related KYC, geographic, database migration, tests, docs",
        "related Android and other application source when tracked",
        "shared source files containing casino integration points",
    ],
    "excludes": [
        "VPS runtime configuration and all API passwords, salts and private keys",
        "database content and user financial records",
        "compiled APKs and node_modules",
        "third-party proprietary SoftAggregator game binaries",
        "any files GitHub does not track",
    ],
    "number_of_files": len(picked),
    "skipped_oversize_files": skipped_large,
    "skipped_private_config_files": skipped_unsafe,
    "files_sha256": sha_manifest,
}
readme = """# BetVima casino integration source export

This archive is a handoff of the casino-related **tracked source files** from
BetVima's GitHub repository, preserving their repository-relative paths.
It covers frontend, API, server provider integration, wallet/callback source,
relevant database SQL, Cloudflare, Android integration points, tests and docs.

This is NOT the full BetVima monorepo, installed dependencies, an Android APK,
a database backup, a game catalog of proprietary game binaries, or a production
server configuration. All those are outside the tracked casino source scope.
To run or build it independently, integrate these files into the original
project and supply your own authorized provider credentials privately.

No live-wallet flags have been switched on; this export changes nothing
on the deployed website or server. Do not put production vendor secrets into
AI chats, source code, or public archives.

Source commit: """ + revision + "\n"
with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for name, data in sorted(picked.items()):
        archive.writestr("BetVima-Casino/" + name, data)
    archive.writestr("BetVima-Casino/README-CASINO-EXPORT.md", readme)
    archive.writestr("BetVima-Casino/MANIFEST.json", json.dumps(manifest, indent=2))
print(json.dumps({
    "archive": OUTPUT.name,
    "files": len(picked),
    "bytes": OUTPUT.stat().st_size,
    "revision": revision,
}))
