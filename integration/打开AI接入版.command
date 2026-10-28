#!/bin/zsh
cd "$(dirname "$0")/.." || exit 1
SAMPLE_BACKEND_PORT=3002 SAMPLE_FRONTEND_PORT=5174 python3 integration/sample.py start
