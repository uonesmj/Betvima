"""GitHub-hosted runner: short-lived signed identity, no deployment secrets."""
import json, os, sys, urllib.request

def main(mode):
    if mode not in ('preview','production'):raise ValueError('invalid_mode')
    request=urllib.request.Request(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience=betvima-'+mode,
                                  headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request,timeout=20) as response:token=json.load(response)['value']
    print('::add-mask::'+token,flush=True)
    request=urllib.request.Request('https://preview.betvima.com/__ci',data=json.dumps({'mode':mode,'token':token}).encode(),
                                  headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(request,timeout=5500) as response:report=json.load(response)
    if report.get('status')!='verified':raise RuntimeError('deployment_not_verified')
    print(json.dumps(report))

if __name__=='__main__':main(sys.argv[1])
