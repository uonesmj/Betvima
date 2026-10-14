"""Standalone policy tests for production release recovery and migration review.

Import only pure functions from the deployer AST, never its root-only entrypoint.
"""
import ast
import hashlib
import json
import pathlib
import re
import tempfile
import time
import unittest
import urllib.parse
from unittest.mock import Mock

SOURCE=pathlib.Path(__file__).with_name('production.py').read_text()
AST=ast.parse(SOURCE)
NAMES={'files_digest','quarantine_failed','verify_applied_migrations','backup_connection'}
NODES=[n for n in AST.body if isinstance(n,ast.FunctionDef) and n.name in NAMES]
assert len(NODES)==len(NAMES)
scope={'pathlib':pathlib,'re':re,'time':time,'hashlib':hashlib,
       'connection':lambda values: {'PGOPTIONS':'-c default_transaction_read_only=on'}}
exec(compile(ast.Module(body=NODES,type_ignores=[]),'production-only-policy.py','exec'),scope)

class ProductionRecoveryTests(unittest.TestCase):
    def test_archives_only_inactive_exact_candidate(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)/'releases';root.mkdir()
            failed=root/('production-'+'a'*40);failed.mkdir()
            (failed/'partial.txt').write_text('kept for audit')
            self.assertTrue(scope['quarantine_failed'](failed,root,[]))
            self.assertFalse(failed.exists())
            artifacts=list((root.parent/'failed-releases').glob(failed.name+'-*'))
            self.assertEqual(len(artifacts),1)
            self.assertEqual((artifacts[0]/'partial.txt').read_text(),'kept for audit')
            self.assertFalse(scope['quarantine_failed'](failed,root,[]))

    def test_refuses_active_service_or_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)/'releases';root.mkdir()
            current=root/'production-active';current.mkdir()
            apps=[{'name':'live', 'pm2_env':{'status':'online','pm_cwd':str(current)}}]
            with self.assertRaisesRegex(ValueError,'candidate_release_still_running'):
                scope['quarantine_failed'](current,root,apps)
            self.assertTrue(current.exists())
            link=root/'production-link';link.symlink_to(current,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'previous_attempt_requires_inspection'):
                scope['quarantine_failed'](link,root,[])

    def test_only_stopped_matching_candidate_is_eligible(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)/'releases';root.mkdir()
            failed=root/'candidate';failed.mkdir()
            app={'name':'nova-cd-target', 'pm2_env':{'status':'stopped','pm_cwd':str(failed)}}
            with self.assertRaises(ValueError):
                scope['quarantine_failed'](failed,root,[app])
            self.assertTrue(scope['quarantine_failed'](failed,root,[app],
                removable_stopped_process='nova-cd-target'))

class AppliedMigrationTests(unittest.TestCase):
    def setUp(self):
        self._previous=scope.get('c')
        scope['c']=Mock()
    def tearDown(self):
        scope['c']=self._previous

    def test_exact_registered_new_sql_requires_no_migration_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            active=root/'active';active.mkdir()
            new=root/'new';new.mkdir()
            (active/'0195_old.sql').write_text('SELECT 1;')
            (new/'0195_old.sql').write_text('SELECT 1;')
            name='0198_verified.sql';body=b'SELECT 2;'
            (new/name).write_bytes(body)
            digest=hashlib.sha256(body).hexdigest()
            scope['c'].run.return_value=(name+'|'+digest+'|f\n').encode()
            scope['verify_applied_migrations'](new,active,{})
            args,kwargs=scope['c'].run.call_args
            query=kwargs['input'].decode()
            self.assertIn('BEGIN READ ONLY',query)
            self.assertIn('SELECT filename,checksum,baseline',query)
            self.assertNotIn('INSERT INTO nova.migrations',query)
            self.assertNotIn('CREATE OR REPLACE',query)

    def test_historical_0161a_migration_needs_exact_applied_checksum(self):
        """Recognize the one approved legacy filename, never execute its SQL."""
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            active=root/'active';active.mkdir()
            candidate=root/'candidate';candidate.mkdir()
            body=b'create sequence if not exists nova.user_numeric_id_seq;'
            name='0161a_fresh_db_numeric_sequence.sql'
            (candidate/name).write_bytes(body)
            digest=hashlib.sha256(body).hexdigest()
            scope['c'].run.return_value=(name+'|'+digest+'|f\\n').encode()
            scope['verify_applied_migrations'](candidate,active,{})
            query=scope['c'].run.call_args.kwargs['input'].decode()
            self.assertIn('BEGIN READ ONLY',query)
            self.assertIn(name,query)
            for report in (b'',(name+'|incorrect|f\\n').encode(),
                           (name+'|'+digest+'|t\\n').encode()):
                scope['c'].run.return_value=report
                with self.assertRaisesRegex(ValueError,'verified_migration_registry_required'):
                    scope['verify_applied_migrations'](candidate,active,{})
            scope['c'].run.reset_mock()
            scope['c'].run.assert_not_called()

    def test_rejects_other_nonstandard_migration_filenames(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            active=root/'active';active.mkdir()
            candidate=root/'candidate';candidate.mkdir()
            (candidate/'0161b_unapproved_variant.sql').write_text('SELECT 1;')
            scope['c'].run.reset_mock()
            with self.assertRaisesRegex(ValueError,'migration_change_requires_separate_approval'):
                scope['verify_applied_migrations'](candidate,active,{})
            scope['c'].run.assert_not_called()

    def test_unapproved_migration_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);active=root/'active';active.mkdir()
            new=root/'new';new.mkdir()
            (active/'0195_old.sql').write_text('SELECT 1;')
            (new/'0195_old.sql').write_text('SELECT 1;')
            (new/'0198_verified.sql').write_text('SELECT 2;')
            for report in (b'',b'0198_verified.sql|badchecksum|f\n',
                           b'0198_verified.sql|badchecksum|t\n'):
                scope['c'].run.return_value=report
                with self.assertRaisesRegex(ValueError,'verified_migration_registry_required'):
                    scope['verify_applied_migrations'](new,active,{})
            (new/'0195_old.sql').write_text('DROP TABLE nova.bets;')
            with self.assertRaisesRegex(ValueError,'migration_change_requires_separate_approval'):
                scope['verify_applied_migrations'](new,active,{})
            scope['c'].run.reset_mock()
            scope['c'].run.assert_not_called()

class SessionBackupConnectionTests(unittest.TestCase):
    POOLER='aws-0-eu-west-1.pooler.supabase.com'
    VALID_URL='postgresql://postgres.mqygiufkubxxxjodsycu:REDACTED@'+POOLER+':6543/postgres'

    def setUp(self):
        self._connection=scope.get('connection')
        self.mock=Mock(return_value={
            'PGHOST':self.POOLER,'PGPORT':'6543',
            'PGSSLMODE':'verify-full',
            'PGSSLROOTCERT':'/root/betvima-public-ca.crt',
            'PGOPTIONS':'-c default_transaction_read_only=on -c statement_timeout=0 -c lock_timeout=3000',
            'PGUSER':'postgres.mqygiufkubxxxjodsycu',
            'PGPASSWORD':'NOT-A-REAL-PASSWORD'
        })
        scope['connection']=self.mock
        scope['urllib']=urllib

    def tearDown(self):
        scope['connection']=self._connection

    def test_backup_uses_session_pooler_only_without_mutating_live_web_credentials(self):
        values={'SUPABASE_DB_URL':self.VALID_URL}
        conn=scope['backup_connection'](values)
        self.assertEqual(conn['PGPORT'],'5432')
        self.assertEqual(conn['PGHOST'],self.POOLER)
        self.assertEqual(conn['PGSSLMODE'],'verify-full')
        self.assertEqual(conn['PGPASSWORD'],'NOT-A-REAL-PASSWORD')
        self.assertEqual(conn['PGSSLROOTCERT'],'/root/betvima-public-ca.crt')
        self.assertIn('statement_timeout=0',conn['PGOPTIONS'])
        self.assertEqual(conn['PGAPPNAME'],'betvima_pre_release_verified_backup')
        self.assertEqual(values['SUPABASE_DB_URL'],self.VALID_URL)
        self.mock.assert_called_once_with(values)

    def test_direct_or_wrong_pooler_identity_rejected_without_connection(self):
        for url in (
            'postgresql://postgres:REDACTED@db.mqygiufkubxxxjodsycu.supabase.co:5432/postgres',
            'postgresql://postgres.mqygiufkubxxxjodsycu:REDACTED@'+self.POOLER+':5432/postgres',
            'postgresql://postgres.mqygiufkubxxxjodsycu:REDACTED@evil.pooler.supabase.com.attacker.test:6543/postgres',
            'postgresql://wrong:REDACTED@'+self.POOLER+':6543/postgres',
        ):
            with self.subTest(url=url),self.assertRaisesRegex(ValueError,'backup_session_pooler_required'):
                scope['backup_connection']({'SUPABASE_DB_URL':url})
        self.mock.assert_not_called()

    def test_tls_or_transaction_mode_cannot_be_bypassed(self):
        baseline=self.mock.return_value.copy()
        for field,value in (
            ('PGSSLMODE','require'),
            ('PGPORT','5432'),
            ('PGHOST','attacker.test'),
            ('PGOPTIONS','-c statement_timeout=300000'),
        ):
            safe=baseline.copy()
            safe[field]=value
            self.mock.return_value=safe
            with self.subTest(field=field),self.assertRaisesRegex(ValueError,'backup_session_pooler_required'):
                scope['backup_connection']({'SUPABASE_DB_URL':self.VALID_URL})
            self.mock.reset_mock()

if __name__=='__main__':unittest.main()
