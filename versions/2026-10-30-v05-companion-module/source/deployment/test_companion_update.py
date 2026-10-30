import contextlib,importlib.util,io,json,pathlib,tempfile,unittest,sys
from unittest.mock import patch
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('update',pathlib.Path(__file__).parent/'companion-update/update.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
class UpdateTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.bundle=self.root/'bundle';self.bundle.mkdir();u.BUNDLE=self.bundle
  self.web=self.root/'frontend/dist';self.web.mkdir(parents=True);self.target=self.web/'ai-companion';self.web.joinpath('index.html').write_text('SERVER CUSTOM HTML KEEP');self.web.joinpath('app.js').write_text('SERVER CUSTOM JS KEEP');self.private=self.root/'data.sqlite';self.private.write_text('PRIVATE DATA KEEP')
  payload=self.bundle/'payload';payload.mkdir()
  for n in ['module.js','poses.png','walk.png','assets.json','UPSTREAM-LICENSE.txt']:(payload/n).write_text('module '+n)
  self.m={'format':1,'scope':'companion-module-only','packageId':'test-module','payloadFingerprint':u.fingerprint(payload),'files':u.files(self.bundle)};(self.bundle/'manifest.json').write_text(json.dumps(self.m))
 def tearDown(self):self.tmp.cleanup()
 def install(self,**kw):
  with contextlib.redirect_stdout(io.StringIO()):u.install(self.target,u.manifest(),**kw)
 def receipt(self):return json.loads(u.receipt_path(self.target).read_text())
 def preserved(self):self.assertEqual((self.web/'index.html').read_text(),'SERVER CUSTOM HTML KEEP');self.assertEqual((self.web/'app.js').read_text(),'SERVER CUSTOM JS KEEP');self.assertEqual(self.private.read_text(),'PRIVATE DATA KEEP')
 def test_fresh_install_rollback_and_server_files_untouched(self):
  self.install();r=self.receipt();self.assertTrue((self.target/'module.js').is_file());self.preserved()
  with contextlib.redirect_stdout(io.StringIO()):u.rollback(self.target,r['backupId'])
  self.assertFalse(self.target.exists());self.preserved()
 def test_existing_module_backup_and_rollback(self):
  self.target.mkdir();(self.target/'old.js').write_text('old module');before=u.fingerprint(self.target);self.install(expected=before);r=self.receipt()
  with contextlib.redirect_stdout(io.StringIO()):u.rollback(self.target,r['backupId'])
  self.assertEqual(u.fingerprint(self.target),before);self.preserved()
 def test_html_in_payload_and_tamper_refused(self):
  (self.bundle/'payload/index.html').write_text('forbidden')
  with self.assertRaises(RuntimeError):u.manifest()
 def test_custom_module_refused_without_review(self):
  self.target.mkdir();(self.target/'custom.js').write_text('custom')
  with self.assertRaises(RuntimeError):self.install()
  self.preserved()
 def test_repeat_is_idempotent(self):self.install();r=self.receipt();self.install();self.assertEqual(self.receipt(),r)
 def test_failure_after_switch_restores_absence(self):
  original=u.json_write
  def injected(path,data):
   if path==u.receipt_path(self.target):raise OSError('injected failure')
   original(path,data)
  with patch.object(u,'json_write',side_effect=injected):
   with self.assertRaises(OSError):self.install()
  self.assertFalse(self.target.exists());self.preserved()
 def test_rollback_cannot_overwrite_manual_module_work(self):
  self.install();r=self.receipt();(self.target/'later.js').write_text('later')
  with self.assertRaises(RuntimeError):u.rollback(self.target,r['backupId'])
 def test_dry_run_lock_and_symlink(self):
  self.install(dry=True);self.assertFalse(self.target.exists());lock=u.private_root(self.target)/'.companion-update.lock';lock.mkdir()
  with self.assertRaises(RuntimeError):self.install()
  lock.rmdir();self.target.symlink_to(self.web,target_is_directory=True)
  with self.assertRaises(RuntimeError):u.target_path(self.target)
if __name__=='__main__':unittest.main()
