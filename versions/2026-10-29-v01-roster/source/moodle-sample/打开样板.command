#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 scripts/sample.py start
open 'http://127.0.0.1:8873/local/preclass_sample/index.php'
