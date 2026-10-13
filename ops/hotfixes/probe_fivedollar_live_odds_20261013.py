#!/usr/bin/env python3
"""Read-only FiveDollar Ultra quote provenance probe. Does not publish odds or print secrets."""
import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ENV_FILE = pathlib.Path('/var/www/nova/.env.production')
BASE = 'https://api.5dollarfootballapi.com/v1'

def get_key():
    direct = os.environ.get('FIVEDOLLAR_API_KEY')
    if direct:
        return direct
    if not ENV_FILE.is_file():
        raise RuntimeError('PROTECTED_ENV_NOT_FOUND')
    for line in ENV_FILE.read_text(encoding='utf-8').splitlines():
        text = line.strip()
        if text.startswith('FIVEDOLLAR_API_KEY=') or text.startswith('export FIVEDOLLAR_API_KEY='):
            token = text.split('=', 1)[1].strip()
            if len(token) >= 2 and token[0] == token[-1] and token[0] in ("'", '"'):
                token = token[1:-1]
            if not token or not token.startswith('fb_'):
                raise RuntimeError('KEY_NOT_CONFIGURED')
            return token
    raise RuntimeError('KEY_NOT_CONFIGURED')

def call(path, key, params=None):
    url = BASE + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + key,
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)
    if data.get('success') != 1:
        raise RuntimeError('PROVIDER_RESPONSE_NOT_SUCCESSFUL')
    return data

def now_age(t):
    if not t: return None
    try:
        at = datetime.fromisoformat(str(t).replace('Z', '+00:00'))
        return round((datetime.now(timezone.utc)-at).total_seconds())
    except (ValueError, TypeError):
        return None

def main():
    if os.geteuid() != 0:
        raise RuntimeError('ROOT_REQUIRED_TO_READ_PROTECTED_ENV')
    key = get_key()
    status = call('/status', key)
    account = status.get('data') or status
    print('PROVIDER_PLAN', account.get('plan','unknown'))
    print('PROVIDER_RATE', account.get('rate_limit','unknown'))
    live = call('/fixtures', key, {'status':'live','include':'odds','per_page':50})
    data = live.get('data') or []
    if not isinstance(data, list): raise RuntimeError('BAD_FIXTURE_LIST')
    priced = [f for f in data
              if isinstance(f, dict) and isinstance(f.get('odds'),dict)
              and isinstance(f['odds'].get('1x2'),dict)
              and isinstance(f['odds']['1x2'].get('inplay'),dict)
              and all(isinstance(f['odds']['1x2']['inplay'].get(k),(int,float)) and
                      f['odds']['1x2']['inplay'][k]>1.01 for k in ('home','draw','away'))]
    print('LIVE_FIXTURES_FIRST_PAGE',len(data))
    print('LIVE_1X2_WITH_INPLAY_SNAPSHOT',len(priced))
    print('LIVE_HAS_MORE_PAGES', bool((live.get('pagination') or {}).get('has_more')))
    if not priced:
        print('SOURCE_PROVENANCE_CHECK', 'NO_PRICED_SAMPLE')
        return
    fixture_id=str(priced[0]['id'])
    history=call('/fixtures/'+urllib.parse.quote(fixture_id,safe='')+'/odds/history', key,
                 {'bookmaker':'bet365','market':'1x2','per_page':500})
    ticks=(history.get('data') or {}).get('ticks') or []
    latest=ticks[-1] if isinstance(ticks,list) and ticks else {}
    print('SAMPLE_PRICE_HISTORY_TICKS',len(ticks))
    print('SAMPLE_HISTORY_COMPLETE', (history.get('pagination') or {}).get('has_more') is False)
    print('SAMPLE_HISTORY_LATEST_AGE_SECONDS', now_age(latest.get('recorded_at')))
    print('SAMPLE_HISTORY_SUSPENDED', latest.get('suspended') is True)
    print('SAMPLE_1X2_MATCHES_LAST_TICK', all(
        isinstance(latest.get(k),(int,float)) and
        abs(float(priced[0]['odds']['1x2']['inplay'][k])-float(latest[k])) < 0.0001
        for k in ('home','draw','away')))

if __name__=='__main__':
    try: main()
    except Exception as exc:
        # No API response, URL or token is allowed into diagnostics.
        print('PROBE_STOP', type(exc).__name__)
        raise SystemExit(1)
