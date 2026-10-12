import importlib.util,json,pathlib,subprocess,unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('transport',pathlib.Path(__file__).with_name('ci-http.py'))
transport=importlib.util.module_from_spec(spec);spec.loader.exec_module(transport)

class TransportTests(unittest.TestCase):
    def invoke(self,result):
        transport.LOCK.acquire()
        with patch.object(transport.subprocess,'run',return_value=result) as run:
            transport.execute('opaque-test-handle',b'{"mode":"preview","token":"mock"}')
        self.assertFalse(transport.LOCK.locked())
        self.assertEqual(run.call_args.args[0],['/usr/bin/sudo','-n','/usr/local/sbin/betvima-ci'])
        return transport.TASKS['opaque-test-handle']['report']

    def test_success_exposes_only_verified_deployment_identity(self):
        value={'status':'verified','deploy':'preview','revision':'a'*40,'private':'must-not-escape'}
        report=self.invoke(subprocess.CompletedProcess([],0,json.dumps(value).encode(),b''))
        self.assertEqual(report,{k:value[k] for k in ('status','deploy','revision')})

    def test_failure_suppresses_command_output_and_credentials(self):
        report=self.invoke(subprocess.CompletedProcess([],1,b'private output',b'private diagnostics'))
        self.assertEqual(report['status'],'blocked_or_failed')
        self.assertNotIn('private output',json.dumps(report))

    def test_failed_release_reports_only_fixed_safe_phase_and_reason(self):
        value={'status':'blocked_or_failed','stage':'migration_registry',
               'reason':'verified_migration_registry_required',
               'private':'DB_PASSWORD=dont-leak'}
        report=self.invoke(subprocess.CompletedProcess([],1,
            json.dumps(value).encode(),b'DB_PASSWORD=dont-leak'))
        self.assertEqual(report,{
            'status':'blocked_or_failed',
            'stage':'migration_registry',
            'reason':'verified_migration_registry_required'})
        self.assertNotIn('dont-leak',json.dumps(report))

    def test_unknown_failures_never_leak_through_ticket(self):
        value={'status':'blocked_or_failed','stage':'API_KEY=secret',
               'reason':'POSTGRES=private'}
        report=self.invoke(subprocess.CompletedProcess([],1,json.dumps(value).encode(),b''))
        self.assertEqual(report,{
            'status':'blocked_or_failed','stage':'unknown',
            'reason':'details_suppressed'})

    def test_invalid_success_cannot_be_reported_as_verified(self):
        report=self.invoke(subprocess.CompletedProcess([],0,b'{"status":"running"}',b''))
        self.assertEqual(report['status'],'blocked_or_failed')

if __name__=='__main__':unittest.main()
