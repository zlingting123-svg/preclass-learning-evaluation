import contextlib,hashlib,importlib.util,io,json,pathlib,tempfile,unittest
from unittest.mock import patch
import sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('update',pathlib.Path(__file__).parent/'companion-update/update.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
class UpdateTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.bundle=self.root/'bundle';self.bundle.mkdir();u.BUNDLE=self.bundle
  self.target=self.root/'app/frontend/dist';self.target.mkdir(parents=True)
  for name in ['index.html','design-preview.html']:(self.target/name).write_text('old '+name)
  (self.target/'assets').mkdir();(self.target/'assets/old-abcdef.js').write_text('old lazy asset')
  self.private=self.root/'app/data.sqlite';self.private.write_text('synthetic data keep')
  payload=self.bundle/'payload';payload.mkdir();(payload/'index.html').write_text('new');(payload/'design-preview.html').write_text('new selected');(payload/'assets').mkdir();(payload/'assets/new-abcdef.js').write_text('new js')
  self.before=u.fingerprint(self.target);self.m={'format':1,'scope':'frontend-only','packageId':'test-v05','baseFingerprints':[self.before],'payloadFingerprint':u.fingerprint(payload),'files':u.files(self.bundle)}
  (self.bundle/'manifest.json').write_text(json.dumps(self.m))
 def tearDown(self):self.tmp.cleanup()
 def install(self,**kwargs):
  with contextlib.redirect_stdout(io.StringIO()):u.install(self.target,u.manifest(),**kwargs)
 def receipt(self):return json.loads((self.target.parent/'.companion-update-state.json').read_text())
 def test_atomic_install_preserves_data_old_assets_and_exact_rollback(self):
  self.install();r=self.receipt();self.assertEqual((self.target/'design-preview.html').read_text(),'new selected');self.assertTrue((self.target/'assets/old-abcdef.js').is_file());self.assertEqual(self.private.read_text(),'synthetic data keep')
  with contextlib.redirect_stdout(io.StringIO()):u.rollback(self.target,r['backupId'])
  self.assertEqual(u.fingerprint(self.target),self.before);self.assertEqual(self.private.read_text(),'synthetic data keep')
 def test_tamper_and_extra_package_files_rejected(self):
  (self.bundle/'payload/index.html').write_text('tampered')
  with self.assertRaises(RuntimeError):u.manifest()
 def test_custom_server_web_changes_are_not_overwritten(self):
  (self.target/'custom.html').write_text('colleague work')
  with self.assertRaises(RuntimeError):self.install()
  self.assertEqual((self.target/'custom.html').read_text(),'colleague work')
 def test_repeat_is_idempotent(self):
  self.install();r=self.receipt();self.install();self.assertEqual(self.receipt(),r)
 def test_failure_after_switch_automatically_restores(self):
  original=u.json_write
  def injected(path,data):
   if path.name=='.companion-update-state.json':raise OSError('simulated receipt failure')
   original(path,data)
  with patch.object(u,'json_write',side_effect=injected):
   with self.assertRaises(OSError):self.install()
  self.assertEqual(u.fingerprint(self.target),self.before)
 def test_rollback_cannot_overwrite_subsequent_work(self):
  self.install();r=self.receipt();(self.target/'new-work.html').write_text('newer work')
  with self.assertRaises(RuntimeError):u.rollback(self.target,r['backupId'])
 def test_dry_run_leaves_no_backup_or_changes(self):
  self.install(dry=True);self.assertEqual(u.fingerprint(self.target),self.before);self.assertFalse((self.target.parent/'.companion-update-backups').exists())
 def test_lock_and_symlink_refused(self):
  lock=self.target.parent/'.companion-update.lock';lock.mkdir()
  with self.assertRaises(RuntimeError):self.install()
  lock.rmdir();(self.target/'data-link').symlink_to(self.private)
  with self.assertRaises(RuntimeError):u.fingerprint(self.target)
if __name__=='__main__':unittest.main()
