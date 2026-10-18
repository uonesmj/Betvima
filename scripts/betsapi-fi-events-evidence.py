#!/usr/bin/env python3
"""Read-only evidence report for Bet365 FI versus BetsAPI Events IDs.

Never writes database rows or approves a fixture link. Token is entered via getpass,
not printed or stored. Results are diagnostic candidates only.
"""
import getpass
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.b365api.com"
EXCLUDED = ("esoccer", "virtual", "cyber", "gg league", "battle volta")


def request(path, token, timeout):
    url = BASE + path + "?" + urllib.parse.urlencode({"sport_id": "1", "token": token})
    started = time.monotonic()
    with urllib.request.urlopen(url, timeout=timeout) as response:
        data = json.load(response)
    if str(data.get("success")) != "1" or not isinstance(data.get("results"), list):
        raise ValueError("INVALID_RESPONSE")
    return data["results"], round(time.monotonic() - started, 2)


def normalized_team(raw):
    value = unicodedata.normalize("NFKC", str(raw or "")).casefold()
    return " ".join(re.findall(r"[^\W_]+", value, flags=re.UNICODE))


def identity(row):
    if not isinstance(row, dict):
        return None
    league = row.get("league") or {}
    if not isinstance(league, dict):
        return None
    if any(word in str(league.get("name", "")).lower() for word in EXCLUDED):
        return None
    home, away = row.get("home") or {}, row.get("away") or {}
    if not isinstance(home, dict) or not isinstance(away, dict):
        return None
    home_name, away_name = normalized_team(home.get("name")), normalized_team(away.get("name"))
    if not home_name or not away_name or home_name == away_name:
        return None
    event_id = str(row.get("id") or "")
    if not re.fullmatch(r"[0-9]{1,16}", event_id):
        return None
    try:
        epoch = int(row.get("time"))
        if not (1500000000 <= epoch <= 4102444800):
            return None
    except (ValueError, TypeError):
        return None
    return {"id": event_id, "home": home_name, "away": away_name, "epoch": epoch,
            "league": str(league.get("name") or "")[:100]}


def compare(bet365_rows, events_rows):
    bet365 = [item for row in bet365_rows if (item := identity(row))]
    events = [item for row in events_rows if (item := identity(row))]
    fi_to_events = {}
    event_to_fis = {}
    for fi in bet365:
        matches = [event for event in events
                   if fi["home"] == event["home"] and fi["away"] == event["away"]
                   and abs(fi["epoch"] - event["epoch"]) <= 300]
        if matches:
            fi_to_events[fi["id"]] = (fi, matches)
            for event in matches:
                event_to_fis.setdefault(event["id"], set()).add(fi["id"])
    candidates, ambiguous = [], []
    for fi_id, (fi, matches) in fi_to_events.items():
        if len(matches) == 1 and len(event_to_fis[matches[0]["id"]]) == 1:
            event = matches[0]
            candidates.append({"bet365_fi": fi_id, "events_provider_id": "1:" + event["id"],
                               "home": fi["home"], "away": fi["away"],
                               "kickoff_delta_seconds": abs(fi["epoch"] - event["epoch"]),
                               "independently_verified": False})
        else:
            ambiguous.append({"fi": fi_id, "possible_events": len(matches)})
    return bet365, events, candidates, ambiguous


def main():
    token = getpass.getpass("BetsAPI token (hidden): ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{12,180}", token):
        raise SystemExit("INVALID_TOKEN")
    outputs = {}
    for label, path, timeout in (
        ("bet365", "/v1/bet365/inplay_filter", 35),
        ("events", "/v3/events/inplay", 30),
    ):
        try:
            outputs[label], seconds = request(path, token, timeout)
            print(f"{label}: {len(outputs[label])} raw items, {seconds}s", flush=True)
        except Exception as error:
            print(f"{label}: FAILED ({type(error).__name__}); no links generated", flush=True)
            return 2
    fi, ev, candidates, ambiguous = compare(outputs["bet365"], outputs["events"])
    report = {
        "read_only": True, "verified_links": 0,
        "bet365_usable_fi": len(fi), "events_usable_ids": len(ev),
        "unique_name_time_candidates": len(candidates),
        "ambiguous_fi": len(ambiguous),
        "candidates_sample": candidates[:20],
        "ambiguous_sample": ambiguous[:10],
        "warning": "Names and kickoff provide candidates only; do not insert mappings into wager tables.",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
