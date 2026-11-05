---
description: Run the Threadline headless smoke test and the no-network check
---

Run these in order and report results plainly (what passed, what failed, with output for failures):

1. Syntax-check the inline script:
   `node -e "const s=require('fs').readFileSync('index.html','utf8');require('fs').writeFileSync('/tmp/app.js',s.match(/<script>([\s\S]*)<\/script>/)[1])" && node --check /tmp/app.js`
2. No-network invariant. This must print nothing:
   `grep -nE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|<script src|<link rel|@import|url\(http" index.html`
3. `node --test "tests/*.test.cjs"`
4. `node tools/smoke.cjs`

If a check fails, diagnose the cause in `index.html` (or the test, if the test is wrong) before changing anything, and say which one it was.
