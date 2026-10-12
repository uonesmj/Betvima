"""Regression tests: identify the Nginx-routed web process, not an arbitrary PM2 candidate."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH=pathlib.Path(__file__).with_name('install-backup-session-patch.py')
SPEC=importlib.util.spec_from_file_location('betvima_backup_installer',MODULE_PATH)
installer=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)

REV='0dcade1f3299935e6eaff732484538df62ddf5fa'
OTHER='c82f97b90d7dc48fb84329d5e9f1c069b66d68b2'

def web(rev,port,active='online'):
    return {
        'name':'nova-cd-'+rev[:12],
        'pm2_env':{
            'status':active,'pm_cwd':'/opt/nova-releases/'+rev,
            'PORT':str(port),'SUPABASE_DB_URL':'not-a-real-secret'
        }
    }

def worker(name):
    return {'name':name,'pm2_env':{
        'status':'online','pm_cwd':'/opt/nova-releases/'+REV,'PORT':'3002'
    }}

class RoutedWebSelection(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        base=pathlib.Path(self.folder.name)
        self.route=base/'nginx.conf'
        self.state=base/'production-status.json'
        self.route.write_text('location / { proxy_pass http://127.0.0.1:3002; }')
        self.state.write_text(json.dumps({'state':'healthy','revision':REV}))
        self.apps=[
            web(OTHER,3003),
            worker('betvima-odds-worker'),
            web(REV,3002),
            worker('betvima-settlement-worker'),
        ]
        self.runner=patch.object(installer,'run')
        self.routes=patch.object(installer,'NGINX_ROUTE',self.route)
        self.status=patch.object(installer,'PRODUCTION_STATUS',self.state)
        self.mock_run=self.runner.start()
        self.routes.start()
        self.status.start()
        self.addCleanup(self.runner.stop)
        self.addCleanup(self.routes.stop)
        self.addCleanup(self.status.stop)
        self.mock_run.return_value=subprocess.CompletedProcess(
            [],0,json.dumps(self.apps),'')

    def test_chooses_routed_release_with_other_online_candidate_and_workers(self):
        value=installer.app_env()
        self.assertEqual(value['pm_cwd'],'/opt/nova-releases/'+REV)
        self.assertEqual(value['PORT'],'3002')
        self.assertEqual(self.mock_run.call_count,1)

    def test_does_not_choose_orphaned_candidate_for_mismatched_route(self):
        self.route.write_text('proxy_pass http://127.0.0.1:3004;')
        with self.assertRaisesRegex(SystemExit,'identity mismatch'):
            installer.app_env()

    def test_multiple_upstream_ports_fail_closed(self):
        self.route.write_text(
            'proxy_pass http://127.0.0.1:3002;\n'
            'proxy_pass http://127.0.0.1:3003;\n')
        with self.assertRaisesRegex(SystemExit,'Ambiguous active website'):
            installer.app_env()

    def test_invalid_or_unhealthy_revision_fails_closed(self):
        for revision,state in (('bad-sha','healthy'),(REV,'failed')):
            self.state.write_text(json.dumps({'state':state,'revision':revision}))
            with self.subTest(revision=revision,state=state),self.assertRaises(SystemExit):
                installer.app_env()

    def test_does_not_accept_wrong_cwd_or_name_even_if_port_matches(self):
        for mutation in (
            {'name':'nova-cd-invalid'},
            {'pm2_env':{'status':'online','pm_cwd':'/tmp/attacker','PORT':'3002'}},
        ):
            self.apps=[web(REV,3002)]
            self.apps[0].update(mutation)
            self.apps.extend([worker('betvima-odds-worker'),
                              worker('betvima-settlement-worker')])
            self.mock_run.return_value=subprocess.CompletedProcess(
                [],0,json.dumps(self.apps),'')
            with self.subTest(mutation=mutation),self.assertRaisesRegex(
                SystemExit,'identity mismatch'):
                installer.app_env()

    def test_missing_settlement_worker_is_blocked(self):
        self.apps=[web(REV,3002),worker('betvima-odds-worker')]
        self.mock_run.return_value=subprocess.CompletedProcess(
            [],0,json.dumps(self.apps),'')
        with self.assertRaisesRegex(SystemExit,'Protected worker'):
            installer.app_env()

if __name__=='__main__':unittest.main()
