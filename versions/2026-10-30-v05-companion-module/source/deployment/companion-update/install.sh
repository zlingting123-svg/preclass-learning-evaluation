#!/bin/bash
set -euo pipefail
bundle="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v python3 >/dev/null || { echo 'Python3 is required (included in the original deployment prerequisites)' >&2;exit 1; }
exec python3 "$bundle/update.py" "$@"
