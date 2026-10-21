import contextlib,io,json,unittest,urllib.error
from unittest.mock import patch
import dispatch

def response(value):return contextlib.closing(io.BytesIO(json.dumps(value).encode()))

class DispatchTests(unittest.TestCase):
    def test_busy_admission_refreshes_identity_then_polls_without_resubmission(self):
        calls=[]
        outcomes=[response({'value':'mock-first'}),urllib.error.HTTPError('https://example.test',409,'busy',{},None),response({'value':'mock-second'}),response({'status':'running','ticket':'mock-handle'}),response({'status':'running'}),response({'status':'verified','revision':'a'*40,'deploy':'preview'})]
        def open_url(request,**kwargs):
            calls.append(request)
            value=outcomes.pop(0)
            if isinstance(value,Exception):raise value
            return value
        with patch.dict(dispatch.os.environ,{'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1','ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'}),patch.object(dispatch.urllib.request,'urlopen',side_effect=open_url),patch.object(dispatch.time,'sleep'),patch('sys.stdout',io.StringIO()):
            dispatch.main('preview')
        posts=[json.loads(r.data) for r in calls if r.data]
        self.assertEqual(posts[:2],[{'mode':'preview','token':'mock-first'},{'mode':'preview','token':'mock-second'}])
        self.assertEqual(posts[2:],[{'ticket':'mock-handle'},{'ticket':'mock-handle'}])

    def test_ticket_poll_recovers_from_tcp_timeout_without_resubmitting_production(self):
        calls=[]
        outcomes=[
            response({'value':'mock-identity'}),
            response({'status':'running','ticket':'mock-ticket'}),
            urllib.error.URLError(TimeoutError('timed out')),
            response({'status':'verified','deploy':'production','revision':'a'*40}),
        ]
        def open_url(request,**kwargs):
            calls.append(request)
            outcome=outcomes.pop(0)
            if isinstance(outcome,Exception):raise outcome
            return outcome
        with patch.dict(dispatch.os.environ,{
            'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'
        }),patch.object(dispatch.urllib.request,'urlopen',side_effect=open_url),patch.object(dispatch.time,'sleep'),patch('sys.stdout',io.StringIO()) as output:
            dispatch.main('production')
        posts=[json.loads(r.data) for r in calls if r.data]
        self.assertEqual(posts,[{'mode':'production','token':'mock-identity'},
                                {'ticket':'mock-ticket'},{'ticket':'mock-ticket'}])
        self.assertEqual(len(calls),4)
        self.assertIn('ci_ticket_poll_transient_connection_failure',output.getvalue())

    def test_ticket_poll_stops_after_repeated_network_errors_without_resubmission(self):
        calls=[]
        outcomes=[response({'value':'mock-identity'}),
                  response({'status':'running','ticket':'mock-ticket'})]+[
                  urllib.error.URLError('TCP down') for _ in range(6)]
        def open_url(request,**kwargs):
            calls.append(request)
            outcome=outcomes.pop(0)
            if isinstance(outcome,Exception):raise outcome
            return outcome
        with patch.dict(dispatch.os.environ,{
            'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'
        }),patch.object(dispatch.urllib.request,'urlopen',side_effect=open_url),patch.object(dispatch.time,'sleep'),patch('sys.stdout',io.StringIO()):
            with self.assertRaisesRegex(RuntimeError,'ci_ticket_poll_network_unavailable') as error:
                dispatch.main('production')
        posts=[json.loads(r.data) for r in calls if r.data]
        self.assertEqual(posts.count({'mode':'production','token':'mock-identity'}),1)
        self.assertEqual(posts.count({'ticket':'mock-ticket'}),6)
        self.assertNotIn('TCP down',str(error.exception))

    def test_ticket_poll_refuses_http_authorization_failure_without_retry(self):
        calls=[]
        outcomes=[response({'value':'mock-identity'}),
                  response({'status':'running','ticket':'mock-ticket'}),
                  urllib.error.HTTPError('https://example.test',403,'forbidden',{},None)]
        def open_url(request,**kwargs):
            calls.append(request)
            outcome=outcomes.pop(0)
            if isinstance(outcome,Exception):raise outcome
            return outcome
        with patch.dict(dispatch.os.environ,{
            'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'
        }),patch.object(dispatch.urllib.request,'urlopen',side_effect=open_url),patch.object(dispatch.time,'sleep'),patch('sys.stdout',io.StringIO()):
            with self.assertRaises(urllib.error.HTTPError):dispatch.main('production')
        self.assertEqual(len(calls),3)

    def test_explicit_safe_stage_surfaces_without_server_secrets(self):
        responses=[response({'value':'mock-identity'}),response({
            'status':'blocked_or_failed','stage':'build',
            'reason':'command_failed_output_suppressed','secret':'must-not-leak'})]
        with patch.dict(dispatch.os.environ,{
            'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'
        }),patch.object(dispatch.urllib.request,'urlopen',side_effect=responses):
            with self.assertRaisesRegex(RuntimeError,
                'deployment_not_verified: stage=build reason=command_failed_output_suppressed') as error:
                dispatch.main('production')
        self.assertNotIn('must-not-leak',str(error.exception))

    def test_untrusted_failure_stage_is_redacted(self):
        responses=[response({'value':'mock-identity'}),response({
            'status':'blocked_or_failed',
            'stage':'TOKEN_from_credential','reason':'password=secret'})]
        with patch.dict(dispatch.os.environ,{
            'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1',
            'ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'
        }),patch.object(dispatch.urllib.request,'urlopen',side_effect=responses):
            with self.assertRaisesRegex(RuntimeError,
                'stage=unknown reason=details_suppressed'):
                dispatch.main('production')

    def test_authorization_failure_is_not_retried(self):
        with patch.dict(dispatch.os.environ,{'ACTIONS_ID_TOKEN_REQUEST_URL':'https://identity.test?request=1','ACTIONS_ID_TOKEN_REQUEST_TOKEN':'mock-runner'}),patch.object(dispatch.urllib.request,'urlopen',side_effect=[response({'value':'mock'}),urllib.error.HTTPError('https://example.test',403,'blocked',{},None)]) as request,patch('sys.stdout',io.StringIO()):
            with self.assertRaises(urllib.error.HTTPError):dispatch.main('production')
        self.assertEqual(request.call_count,2)
