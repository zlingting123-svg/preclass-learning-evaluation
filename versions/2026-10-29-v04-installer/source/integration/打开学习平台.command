#!/bin/zsh
cd "${0:A:h:h}"
python3 integration/sample.py start && open http://127.0.0.1:5173
