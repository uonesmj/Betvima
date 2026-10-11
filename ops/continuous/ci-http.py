"""Loopback transport only. Root's fixed controller validates signed OIDC claims."""
import http.server,json,secrets,subprocess,threading,time
LOCK=threading.Lock()
TASKS={}
TASKS_LOCK=threading.Lock()

def execute(ticket,data):
    report={'status':'blocked_or_failed','details':'private_server_diagnostics'}
    try:
        result=subprocess.run(['/usr/bin/sudo','-n','/usr/local/sbin/betvima-ci'],input=data,capture_output=True,timeout=5500)
        if result.returncode==0:
            value=json.loads(result.stdout)
            if value.get('status')=='verified':
                report={k:value[k] for k in ('status','deploy','revision')}
    except Exception:pass
    finally:
        with TASKS_LOCK:TASKS[ticket]={'created':time.monotonic(),'report':report}
        LOCK.release()

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def reply(self,status,value):
        body=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_POST(self):
        try:
            if self.path!='/__ci':return self.reply(404,{'status':'not_found'})
            size=int(self.headers.get('Content-Length','0'))
            if not 1<=size<=25000:return self.reply(413,{'status':'invalid_body'})
            data=self.rfile.read(size);payload=json.loads(data)
            if set(payload)=={'ticket'} and isinstance(payload['ticket'],str):
                with TASKS_LOCK:task=TASKS.get(payload['ticket'])
                if not task or time.monotonic()-task['created']>7200:return self.reply(404,{'status':'unknown_request'})
                return self.reply(200,task['report'])
            if set(payload)!={'mode','token'} or payload['mode'] not in ('preview','production') or not isinstance(payload['token'],str):return self.reply(400,{'status':'invalid_body'})
            if not LOCK.acquire(blocking=False):return self.reply(409,{'status':'deployment_busy'})
            ticket=secrets.token_urlsafe(32)
            with TASKS_LOCK:
                for old in list(TASKS):
                    if time.monotonic()-TASKS[old]['created']>7200:del TASKS[old]
                TASKS[ticket]={'created':time.monotonic(),'report':{'status':'running'}}
            threading.Thread(target=execute,args=(ticket,data),daemon=True).start()
            self.reply(202,{'status':'running','ticket':ticket})
        except Exception:self.reply(503,{'status':'failed_details_suppressed'})
    def do_GET(self):self.reply(405,{'status':'method_not_allowed'})
if __name__=='__main__':http.server.ThreadingHTTPServer(('127.0.0.1',3299),Handler).serve_forever()
