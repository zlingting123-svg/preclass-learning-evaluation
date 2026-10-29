#!/bin/bash
set -euo pipefail
# Run only via the root-owned systemd backup unit. Stop writes for a consistent full snapshot.
if [[ "$(id -u)" != 0 ]]; then echo 'Use the systemd preclass-backup service' >&2; exit 1; fi
was_active=0
if systemctl is-active --quiet preclass.service; then was_active=1; fi
restart_app() { if [[ "$was_active" == 1 ]]; then systemctl start preclass.service; fi; }
trap restart_app EXIT
systemctl stop preclass.service
if systemctl is-active --quiet preclass.service; then echo 'Application still active' >&2; exit 1; fi
FULL_BACKUP=1 PRECLASS_OFFLINE_BACKUP=1 /usr/local/bin/node /opt/preclass/current/deployment/backup.mjs
