import base64, importlib.util, io, json, os, pathlib, sys, tarfile, tempfile, types, unittest
from unittest.mock import patch

if sys.platform=='win32':sys.modules.setdefault('fcntl',types.SimpleNamespace())
spec=importlib.util.spec_from_file_location('controller',pathlib.Path(__file__).with_name('controller.py'));c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

def tar(entries):
    out=io.BytesIO()
    with tarfile.open(fileobj=out,mode='w') as archive:
        for name,content,kind in entries:
            member=tarfile.TarInfo(name);member.size=len(content)
            if kind=='link':member.type=tarfile.SYMTYPE;member.linkname='/root/.ssh/authorized_keys'
            archive.addfile(member,io.BytesIO(content) if kind=='file' else None)
    return out.getvalue()

class SnapshotSafety(unittest.TestCase):
    def test_excludes_secrets_apk_and_execution_metadata(self):
        for name in ('../escape','/root/key','src/../../key','.env.production','src/.env','node_modules/x','.git/config','public/downloads/BetVima.apk','private-key.txt','cert.key','a\\b'):
            with self.subTest(name=name):self.assertFalse(c.accepted_path(name))
        self.assertTrue(c.accepted_path('src/app/page.tsx'))
    def test_extracts_regular_source_only(self):
        with tempfile.TemporaryDirectory() as d:
            target=pathlib.Path(d)/'snapshot';target.mkdir()
            self.assertEqual(c.unpack(tar([('src/app/page.tsx',b'hello','file')]),target),{'src/app/page.tsx'})
            self.assertEqual((target/'src/app/page.tsx').read_bytes(),b'hello')
    def test_rejects_symlink_archive(self):
        with tempfile.TemporaryDirectory() as d,self.assertRaises(ValueError):c.unpack(tar([('src/key',b'','link')]),pathlib.Path(d))
    def test_rejects_duplicate_members(self):
        with tempfile.TemporaryDirectory() as d,self.assertRaises(ValueError):c.unpack(tar([('a',b'one','file'),('a',b'two','file')]),pathlib.Path(d))
    def test_rejects_private_key(self):
        with tempfile.TemporaryDirectory() as d,self.assertRaises(ValueError):c.unpack(tar([('src/a.txt',b'-----BEGIN OPENSSH PRIVATE KEY-----','file')]),pathlib.Path(d))
    def test_no_financial_credentials_in_preview_environment(self):
        self.assertEqual(c.PREVIEW_ENV['PAYMENT_PROVIDER'],'disabled')
        for name in ('DATABASE_URL','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','UWALLET_TOKEN','PAYMENT_PROVIDER_API_KEY','ODDS_API_KEY','FIVEDOLLAR_API_KEY'):
            self.assertNotIn(name,c.PREVIEW_ENV)
    def test_dependency_fetch_rejects_non_registry_urls_links_and_mismatched_lock(self):
        package={'dependencies':{'a':'1.0.0'}}
        valid={'lockfileVersion':3,'packages':{'':package,'node_modules/a':{'resolved':'https://registry.npmjs.org/a/-/a-1.0.0.tgz','integrity':'sha512-test'}}}
        c.validate_dependency_lock(valid,package)
        for item in ({'resolved':'https://payments.example/a','integrity':'x'},{'resolved':'http://registry.npmjs.org/a','integrity':'x'},{'link':True},{'resolved':'https://registry.npmjs.org/a'}):
            bad={**valid,'packages':{'':package,'node_modules/a':item}}
            with self.subTest(item=item),self.assertRaises(ValueError):c.validate_dependency_lock(bad,package)
        with self.assertRaises(ValueError):c.validate_dependency_lock(valid,{'dependencies':{'a':'2.0.0'}})
    def test_installer_enforces_network_and_resource_isolation(self):
        text=pathlib.Path(__file__).with_name('install.py').read_text()
        for marker in ('PrivateNetwork=yes','ProtectSystem=strict','ProtectProc=invisible','CPUQuota=50%','MemoryMax=1800M','auth_basic_user_file','return 403','return 405','127.0.0.1:'):
            self.assertIn(marker,text)
        self.assertNotIn('restart nginx',text)
    def test_production_has_no_migration_or_worker_execution(self):
        text=pathlib.Path(__file__).with_name('production.py').read_text()
        self.assertIn('migration_change_requires_separate_approval',text)
        self.assertIn('wait_health(\'https://betvima.com\',oldbuild)',text)
        for forbidden in ('db-migrate.sh','ecosystem.config','worker:payment','worker:settlement','pm2([\'restart\'','reset --hard'):
            self.assertNotIn(forbidden,text)
    @unittest.skipIf(os.name=='nt','Windows account cannot create symlinks; exercised on the Linux server and CI')
    def test_failed_preview_health_restores_previous_preview(self):
        with tempfile.TemporaryDirectory() as d:
            root=pathlib.Path(d);state=root/'state';state.mkdir();old=root/'old';old.mkdir();new=root/'new';new.mkdir();(new/'.next').mkdir();(new/'.next/BUILD_ID').write_text('candidate-build')
            (root/'current').symlink_to(old,target_is_directory=True)
            with patch.object(c,'ROOT',root),patch.object(c,'STATE',state),patch.object(c,'sandbox',return_value=b''),patch.object(c,'run',return_value=b'') as run,patch.object(c,'verify_web',side_effect=ValueError('preview_health_failed')):
                with self.assertRaises(ValueError):c.publish_preview(new,run_tests=False)
                self.assertEqual((root/'current').resolve(),old.resolve())
                self.assertEqual(sum(call.args[0]==['systemctl','restart','betvima-preview.service'] for call in run.call_args_list),2)

@unittest.skipUnless(importlib.util.find_spec('cryptography'),'cryptography required for signature tests')
class IdentitySafety(unittest.TestCase):
    def setUp(self):
        from cryptography.hazmat.primitives.asymmetric import rsa
        self.key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        self.claims={'iss':'https://token.actions.githubusercontent.com','aud':'betvima-production','repository':'uonesmj/Betvima','repository_owner':'uonesmj',
                     'repository_id':'1413860117','repository_owner_id':'340808306',
                     'nbf':900,'iat':900,'exp':1100,'sha':'a'*40,'ref':'refs/heads/main','actor':'uonesmj','event_name':'workflow_dispatch',
                     'workflow_ref':'uonesmj/Betvima/.github/workflows/continuous.yml@refs/heads/main','jti':'test-token'}
    def b64(self,data):return base64.urlsafe_b64encode(data).decode().rstrip('=')
    def token(self,changes=None,tamper=False):
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives import hashes
        body={**self.claims,**(changes or {})}
        message=self.b64(json.dumps({'alg':'RS256','kid':'test'}).encode())+'.'+self.b64(json.dumps(body).encode())
        signed=self.key.sign(message.encode(),padding.PKCS1v15(),hashes.SHA256())
        if tamper:signed=bytes([signed[0]^1])+signed[1:]
        return message+'.'+self.b64(signed)
    def keys(self):
        numbers=self.key.public_key().public_numbers()
        def enc(i):return self.b64(i.to_bytes((i.bit_length()+7)//8,'big'))
        return io.BytesIO(json.dumps({'keys':[{'kid':'test','e':enc(numbers.e),'n':enc(numbers.n)}]}).encode())
    def test_accepts_owner_explicit_production_approval(self):
        with patch.object(c.urllib.request,'urlopen',return_value=self.keys()):self.assertEqual(c.verify_oidc(self.token(),'production',1000)['sha'],'a'*40)
    def test_rejects_unsigned_or_modified_token(self):
        with patch.object(c.urllib.request,'urlopen',return_value=self.keys()),self.assertRaises(Exception):c.verify_oidc(self.token(tamper=True),'production',1000)
    def test_rejects_push_as_production_approval(self):
        with self.assertRaises(ValueError):c.verify_oidc(self.token({'event_name':'push'}),'production',1000)
    def test_rejects_other_actor_repository_branch_workflow_and_expiry(self):
        for change in ({'actor':'other'},{'repository':'other/repo'},{'ref':'refs/heads/codex/x'},{'workflow_ref':'other'},{'exp':999},{'aud':'betvima-preview'}):
            with self.subTest(change=change),self.assertRaises(ValueError):c.verify_oidc(self.token(change),'production',1000)

if __name__=='__main__':unittest.main()
