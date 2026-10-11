"""GitHub-hosted runner: short-lived signed identity, no deployment secrets."""
import json, os, sys, time, urllib.request, urllib.error

def main(mode):
    if mode not in ('preview','production'):raise ValueError('invalid_mode')
    # Builds outlive ordinary network/proxy connections. Submit once, then poll
    # the opaque request handle; never replay the single-use GitHub identity.
    admission_deadline=time.monotonic()+1200
    while True:
        request=urllib.request.Request(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience=betvima-'+mode,
                                      headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
        with urllib.request.urlopen(request,timeout=20) as response:token=json.load(response)['value']
        print('::add-mask::'+token,flush=True)
        request=urllib.request.Request('https://preview.betvima.com/__ci',data=json.dumps({'mode':mode,'token':token}).encode(),
                                      headers={'Content-Type':'application/json'},method='POST')
        try:
            with urllib.request.urlopen(request,timeout=60) as response:report=json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code not in (409,429) or time.monotonic()>=admission_deadline:raise
            # These responses explicitly mean the job was not admitted. A fresh
            # identity is required after waiting; an accepted job is never resubmitted.
            time.sleep(35)
    ticket=report.get('ticket')
    if ticket:
        print('::add-mask::'+ticket,flush=True)
        deadline=time.monotonic()+5500
        while report.get('status')=='running' and time.monotonic()<deadline:
            time.sleep(35)
            request=urllib.request.Request('https://preview.betvima.com/__ci',data=json.dumps({'ticket':ticket}).encode(),headers={'Content-Type':'application/json'},method='POST')
            with urllib.request.urlopen(request,timeout=60) as response:report=json.load(response)
    if report.get('status')!='verified':raise RuntimeError('deployment_not_verified')
    print(json.dumps(report))

if __name__=='__main__':main(sys.argv[1])
