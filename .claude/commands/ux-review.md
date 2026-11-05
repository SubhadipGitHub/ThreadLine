---
description: Screenshot Threadline at desktop and phone width and review the UX
argument-hint: "[area, e.g. onboarding, media, wrapped]"
---

1. Run `SHOTS=<scratchpad>/shots node tools/smoke.cjs` and read the resulting PNGs (home, demo overview, tour, guide, menu, error dialog, mobile home, mobile tour).
2. Review `$ARGUMENTS` (or everything, if empty) as a first-time user who has never seen the app: can they tell what to do within five seconds, what each number means, how to get help, and how to undo or delete?
3. Check: contrast of secondary text, tap targets of at least 40 px on mobile, focus visibility, anything truncated or overflowing at 390 px, and copy that is vague or jargon-heavy.
4. Report findings ranked by user impact, each with the screenshot it came from and a concrete fix. Do not edit code unless asked.
