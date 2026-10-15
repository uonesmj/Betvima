#!/usr/bin/env python3
"""Provision a root-owned, demo-only SoftAggregator config on the BetVima VPS.

Run as root in an interactive SSH session AFTER the approved demo backend is
published. Never print credentials or launch URLs. No PM2 restart, wallet access,
DB migration or service change is required.
"""
import getpass
import json
import os
import pathlib
import pwd
import secrets
import stat
import sys
import tempfile
import urllib.error
import urllib.request

PATH = pathlib.Path("/etc/betvima/softaggregator-demo.json")
API = "https://api.softaggregator.com/api/v1"


def existing_player_secret():
    try:
        fd = os.open(PATH, os.O_RDONLY | os.O_NOFOLLOW)
    except FileNotFoundError:
        return secrets.token_hex(48)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o027:
            raise ValueError("Unsafe existing configuration permissions")
        with os.fdopen(os.dup(fd), "r", encoding="utf-8") as inp:
            value = json.load(inp)
        secret = value.get("playerSecret") if isinstance(value, dict) else None
        if not isinstance(secret, str) or not 32 <= len(secret) <= 512:
            raise ValueError("Existing player identity secret is invalid")
        return secret
    finally:
        os.close(fd)


def verify_vendor(login, password):
    body = json.dumps({
        "api_login": login, "api_password": password, "method": "getCurrencies"
    }).encode("utf-8")
    request = urllib.request.Request(API, body, {
        "Content-Type": "application/json", "User-Agent": "BetVima/1.0"
    }, method="POST")
    with urllib.request.urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError("Supplier HTTP request failed")
        data = json.load(response)
    if data.get("error") != 0 or "USD" not in (data.get("response") or {}).get("currencies", []):
        raise ValueError("Supplier authentication or USD currency validation failed")


def main():
    if os.geteuid() != 0:
        raise SystemExit("Run as root (sudo python3 ...)")
    if not sys.stdin.isatty():
        raise SystemExit("Run in an interactive Termius session")
    group = pwd.getpwnam("novaadmin").pw_gid
    login = getpass.getpass("SoftAggregator API Login: ").strip()
    password = getpass.getpass("SoftAggregator API Password: ")
    if not login or not password or len(login) > 256 or len(password) > 1024:
        raise SystemExit("Empty or invalid supplier credentials")
    try:
        verify_vendor(login, password)
    except (ValueError, urllib.error.URLError, TimeoutError, OSError):
        raise SystemExit("Supplier authentication failed; existing settings unchanged")

    PATH.parent.mkdir(parents=True, exist_ok=True)
    player_secret = existing_player_secret()
    payload = json.dumps({
        "enabled": True, "apiLogin": login,
        "apiPassword": password, "playerSecret": player_secret
    }, separators=(",", ":")).encode("utf-8")
    if len(payload) > 8192:
        raise SystemExit("Config too large")

    fd, temporary = tempfile.mkstemp(prefix=".softaggregator-demo-", dir=PATH.parent)
    try:
        os.fchown(fd, 0, group)
        os.fchmod(fd, 0o640)
        with os.fdopen(fd, "wb", closefd=False) as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(fd)
        os.close(fd)
        fd = -1
        os.replace(temporary, PATH)
        directory_fd = os.open(PATH.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if fd != -1:
            os.close(fd)
        if os.path.exists(temporary):
            os.unlink(temporary)
    print("SoftAggregator demo configuration installed securely.")
    print("Real-money wallet callbacks remain disabled.")
    print("No web server restart or database change was performed.")


if __name__ == "__main__":
    main()
