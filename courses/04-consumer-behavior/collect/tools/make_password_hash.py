# -*- coding: utf-8 -*-
"""수업용 잠금 비밀번호의 SHA-256 해시를 만든다.

사용법:  python tools/make_password_hash.py "새비밀번호"
출력된 값을 gate.js 의 PASSWORD_SHA256 에, worker/steam-proxy.js 의
KEY_SHA256 에 붙여넣는다. 두 곳이 같아야 한다.
"""
import hashlib
import sys

if len(sys.argv) < 2:
    print('사용법: python tools/make_password_hash.py "새비밀번호"')
    raise SystemExit(1)

pw = sys.argv[1]
print(f'PASSWORD_SHA256: "{hashlib.sha256(pw.encode("utf-8")).hexdigest()}",')
