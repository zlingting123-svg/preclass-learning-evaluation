from pathlib import Path
root=Path('/opt/preclass/modules/knowledge-map-v060');assert root.resolve()==root and root.is_dir()
for path in root.rglob('*'):
 if path.is_symlink():continue
 path.chmod(0o755 if path.is_dir() else 0o644)
print('Candidate module source permissions normalized; data directory permissions unchanged')
