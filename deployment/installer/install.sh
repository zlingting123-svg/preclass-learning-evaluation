#!/bin/bash
set -euo pipefail
umask 077
BUNDLE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
domain='';admin='';no_start=0;offline=0;password_stdin=0
fail() { echo "$*" >&2; exit 1; }
while [[ $# -gt 0 ]]; do
 case "$1" in
 --check) python3 "$BUNDLE/verify.py" "$BUNDLE"; exit $?;;
 --domain) domain="${2:?domain required}";shift 2;;
 --admin) admin="${2:?admin required}";shift 2;;
 --no-start) no_start=1;shift;;
 --offline) offline=1;shift;;
 --password-stdin) password_stdin=1;shift;;
 *) fail 'Usage: sudo bash install.sh --domain classroom.example.com --admin course_admin [--no-start] [--offline] [--password-stdin]';;
 esac
done
[[ "$(id -u)" == 0 ]] || fail 'Run the installer with sudo'
# shellcheck disable=SC1091
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 && "$(uname -m)" == x86_64 ]] || fail 'This package targets Ubuntu 24.04 x86_64 only'
command -v python3 >/dev/null || fail 'Install Ubuntu python3 first'
python3 "$BUNDLE/verify.py" "$BUNDLE"
[[ -n "$domain" ]] || read -r -p '正式域名（不带https://）: ' domain </dev/tty
[[ -n "$admin" ]] || read -r -p '管理员账号: ' admin </dev/tty
python3 - "$domain" "$admin" <<'PY'
import re,sys
label=r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
if not re.fullmatch(r'(?:'+label+r'\.)+[a-z]{2,63}',sys.argv[1]) or len(sys.argv[1])>253:raise SystemExit('Invalid domain: use lowercase ASCII/punycode without scheme, port or path')
if not re.fullmatch(r'[a-zA-Z0-9_.@-]{3,100}',sys.argv[2]):raise SystemExit('Invalid admin username')
PY
for path in /etc/preclass.env /opt/preclass/current /opt/preclass/runtime /opt/preclass/python /var/lib/preclass/app.sqlite /etc/systemd/system/preclass.service /etc/systemd/system/preclass-caddy.service; do
 [[ ! -e "$path" && ! -L "$path" ]] || fail 'Existing installation/data detected; refusing to overwrite. Use a reviewed upgrade procedure.'
done
for path in /opt/preclass /var/lib/preclass /var/backups/preclass /var/lib/preclass-caddy; do [[ ! -L "$path" ]] || fail 'Installation directories cannot be symlinks'; done
if [[ "$password_stdin" == 1 ]]; then IFS= read -r admin_password; else
 IFS= read -r -s -p '管理员初始密码（至少12字符）: ' admin_password </dev/tty;echo
 IFS= read -r -s -p '再次输入密码: ' confirm </dev/tty;echo
 [[ "$admin_password" == "$confirm" ]] || fail 'Passwords do not match';unset confirm
fi
# Validate without placing the password in an argument or log.
printf '%s' "$admin_password" | python3 -c 'import sys; p=sys.stdin.read(); sys.exit(0 if len(p)>=12 and len(p.encode())<=72 else "Password needs at least12 characters and at most72 UTF-8 bytes")'
missing=()
for pkg in python3-venv ca-certificates libstdc++6 libatomic1 curl; do
 if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed'; then missing+=("$pkg");fi
done
if [[ ${#missing[@]} -gt 0 ]]; then
 [[ "$offline" != 1 ]] || fail 'Offline installation needs Ubuntu python3-venv, ca-certificates, libstdc++6, libatomic1 and curl already installed'
 apt-get update
 DEBIAN_FRONTEND=noninteractive apt-get install --no-install-recommends -y "${missing[@]}"
fi
python3 - "$no_start" <<'PY'
import socket,sys
for port in ([3001] if sys.argv[1]=='1' else [3001,80,443]):
 s=socket.socket();s.bind(('0.0.0.0',port));s.close()
PY
ensure_user() { if id "$1" >/dev/null 2>&1; then [[ "$(getent passwd "$1" | cut -d: -f7)" == /usr/sbin/nologin ]] || fail 'Conflicting existing service account'; else useradd --system --user-group --home-dir "$2" --shell /usr/sbin/nologin "$1";fi; }
ensure_user preclass /var/lib/preclass
ensure_user preclass-web /var/lib/preclass-caddy
release_id="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["commit"][:12])' "$BUNDLE/manifest.json")"
[[ "$release_id" =~ ^[a-f0-9]{12}$ ]] || fail 'Invalid release identifier'
release="/opt/preclass/releases/$release_id"
[[ ! -e "$release" ]] || fail 'Release directory exists; refusing overwrite'
install -d -m 755 /opt/preclass /opt/preclass/releases /opt/preclass/runtime
install -d -o preclass -g preclass -m 700 /var/lib/preclass
install -d -o root -g root -m 700 /var/backups/preclass
install -d -o preclass-web -g preclass-web -m 700 /var/lib/preclass-caddy
cp -a "$BUNDLE/payload" "$release"
cp -a "$BUNDLE/runtime/." /opt/preclass/runtime/
chown root:root /opt/preclass /opt/preclass/releases /opt/preclass/runtime
chown -R root:root "$release" /opt/preclass/runtime
chmod -R a+rX "$release" /opt/preclass/runtime
node=/opt/preclass/runtime/node/bin/node
"$node" --version
python3 -m venv /opt/preclass/python
/opt/preclass/python/bin/pip install --no-index --find-links "$BUNDLE/wheels" -r "$release/backend/scripts/requirements.txt"
chmod -R a+rX /opt/preclass/python
ln -s "$release" /opt/preclass/current
cat > /etc/preclass.env <<ENV
NODE_ENV=production
DEPLOYMENT_MODE=single-host
AUTH_MODE=local-bcrypt
STORAGE_MODE=local-sqlite
HOST=127.0.0.1
PORT=3001
APP_ORIGIN=https://$domain
STATIC_DIR=/opt/preclass/current/frontend/dist
DB_PATH=/var/lib/preclass/app.sqlite
REFERENCE_PYTHON=/opt/preclass/python/bin/python
PRECLASS_NODE_BINARY=/opt/preclass/runtime/node/bin/node
PYTHONDONTWRITEBYTECODE=1
HTTP_REQUEST_TIMEOUT_MS=120000
BACKUP_DIR=/var/backups/preclass
AI_MODE=disabled
ENV
chmod 600 /etc/preclass.env
(cd "$release/backend";printf '%s\n' "$admin_password" | env -i PATH=/usr/bin:/bin USERNAME="$admin" ROLE=admin DISPLAY_NAME='系统管理员' "$node" --env-file=/etc/preclass.env dist/backend/src/manage.js user)
unset admin_password
chown -R preclass:preclass /var/lib/preclass
install -d -m 755 /etc/preclass
sed "s/classroom.example.com/$domain/g" "$release/deployment/Caddyfile.example" > /etc/preclass/Caddyfile
chown root:preclass-web /etc/preclass/Caddyfile;chmod 640 /etc/preclass/Caddyfile
sed 's|/usr/local/bin/node|/opt/preclass/runtime/node/bin/node|g' "$release/deployment/preclass.service" > /etc/systemd/system/preclass.service
install -m 644 "$release/deployment/preclass-backup.service" "$release/deployment/preclass-backup.timer" /etc/systemd/system/
install -m 644 "$BUNDLE/preclass-caddy.service" /etc/systemd/system/preclass-caddy.service
chmod 644 /etc/systemd/system/preclass.service
/opt/preclass/runtime/caddy/caddy validate --config /etc/preclass/Caddyfile --adapter caddyfile
systemd-analyze verify /etc/systemd/system/preclass.service /etc/systemd/system/preclass-caddy.service /etc/systemd/system/preclass-backup.service /etc/systemd/system/preclass-backup.timer
systemctl daemon-reload
systemctl enable preclass.service preclass-caddy.service preclass-backup.timer
if [[ "$no_start" == 1 ]]; then echo '安装及配置完成，服务尚未启动（--no-start）。';else
 systemctl start preclass.service
 curl -fsS --retry 10 --retry-connrefused --retry-delay 1 -H "Host: $domain" http://127.0.0.1:3001/api/v1/health >/dev/null
 systemctl start preclass-caddy.service preclass-backup.timer
 echo "服务已安装并启动。请验证 https://$domain 的DNS、备案、防火墙及证书状态。"
fi
echo 'AI/搜索保持关闭；初始密码不保存到明文文件。完整备份定时任务会在备份期间停服。'
