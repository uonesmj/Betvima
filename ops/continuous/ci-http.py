"""Loopback transport only. Root's fixed controller validates signed OIDC claims."""
import http.server,json,subprocess,threading
LOCK=threading.Lock()
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
            if set(payload)!={'mode','token'} or not isinstance(payload['token'],str):return self.reply(400,{'status':'invalid_body'})
            if not LOCK.acquire(blocking=False):return self.reply(409,{'status':'deployment_busy'})
            try:
                result=subprocess.run(['/usr/bin/sudo','-n','/usr/local/sbin/betvima-ci'],input=data,capture_output=True,timeout=5500)
                if result.returncode:return self.reply(403,{'status':'blocked_or_failed','details':'private_server_diagnostics'})
                report=json.loads(result.stdout)
                if report.get('status')!='verified':return self.reply(503,{'status':'not_verified'})
                self.reply(200,report)
            finally:LOCK.release()
        except Exception:self.reply(503,{'status':'failed_details_suppressed'})
    def do_GET(self):self.reply(405,{'status':'method_not_allowed'})
if __name__=='__main__':http.server.ThreadingHTTPServer(('127.0.0.1',3299),Handler).serve_forever()
