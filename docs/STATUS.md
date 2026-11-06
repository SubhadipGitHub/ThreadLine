# Status

Audit date: 2026-11-05. State of `index.html` after the onboarding/UX overhaul.

## Verified (automated, `tools/smoke.cjs`, Chromium)

- Parses a synthetic Android-format export for a 2-person and a 4-person chat (~2,900 lines); every tab renders; no console or page errors.
- Save to IndexedDB and reopen from the home list.
- Demo chat, first-run tour (10 steps, desktop and 390 px), tips, guide, ⋯ menu, "change who is You", friendly errors for a non-chat `.txt` and for a drop with no `.txt`.
- No horizontal overflow on home or app at 390 px.
- Zero network-capable calls in the source (grep in `CLAUDE.md` returns nothing).
- GitHub Actions runs the syntax check, no-network grep, unit tests and smoke test on every PR. Added 2026-11-05; the smoke job is the first run on a hosted runner, so check its first result before trusting it.

## Not verified, so don't assume it works

- **Real iOS exports.** No real export is available to this repo and none may be committed, so the iOS fixtures are synthetic. The shapes were cross-checked on 2026-11-06 against two independent public references that describe real exports (neverfar.app/whatsapp-export-format and chat-recap.com/en/guides/whatsapp-export-file-format; links and caveats are in `tests/fixtures.cjs`). That makes them well-grounded, but none of it has been confirmed on a real file by us. To close this: anonymise a real export by hand (keep the header and placeholder lines exactly, replace names, numbers and message text), add it under `tests/fixtures/`, and keep it free of anything identifying.
- **Real zips with media.** The synthetic tests have no media files, so the lightbox, thumbnails, video/audio playback, bulk .zip download and Wrapped photo-free path were only exercised through code reading and the demo.
- **Scale.** Nothing larger than ~4,000 messages was run. The "multi-GB" design (lazy zip slices, worker parsing) is untested here.
- **Safari and Firefox.** Only Chromium was run. `DecompressionStream('deflate-raw')` needs Safari 16.4+.
- **Non-English exports** beyond the attachment phrases listed in `ATT_WORDS`, and right-to-left languages.
- **Screen reader and keyboard-only pass.** Roles, labels and focus rings were added, but nobody has used it with a screen reader.

## Bugs fixed during the overhaul

- Pressing **Esc** on "Which one is you?" removed the dialog without resolving its promise, leaving the chat loaded but never shown. Modals now resolve on a `dismiss` event.
- The header showed three unlabelled icons (one of them an "upload" icon that actually meant "open another chat", another a bin that deleted data). Replaced with labelled Search, Guide and a ⋯ menu.
- `--dim` text (#5b6274) was ~3.3:1 against the background; raised.
- The Media KPI read "0 files in export" with no explanation for text-only exports.

## Known issues and decisions

- `fmtN` uses the `en-IN` locale, so numbers ≥ 100,000 group as 1,00,000. Intentional for an Indian audience? Confirm before changing.
- The last message of every export keeps a trailing `\n` (the file's final blank line is appended as a continuation). Harmless in the UI; pinned in a test with `trimEnd`.
- **Parser gaps found by checking against the documented real shapes** (each is a `todo` test in `tests/parser.test.cjs`; remove `todo` when fixed):
  - iOS group notices are attributed to the group name (`Sunday Dinners: ‎Marta added Anna`). Only notices matching the `SYS` regex are caught (e.g. "created group"); others make the **group name a participant**, which would show up on the leaderboard as a person. Likely the most visible of these in real group chats.
  - `Missed voice call` lines are counted as text the sender wrote.
  - An Android notice whose quoted group name contains `: ` (`changed the subject from "A" to "B: c"`) is split into a phantom sender.
  - Impossible dates (`31/02/2026`) roll into the next month (3 March) instead of being rejected.
  - `Menu.pdf • 3 pages document omitted` (older iOS document line) is parsed as plain text, not as an omitted document.
- `renderTimeline` adds a click listener to its container each time it renders. `changeMe` works around this by replacing the view nodes; any new code that re-renders a view should do the same or use delegation.
- IndexedDB is at schema v1 with no migration path.
- `index.html` is ~1,900 lines and will keep growing. The parser (`CORE`) is the obvious first thing to extract into a testable module, but doing so conflicts with the single-file rule; if you do it, keep a build step that re-inlines it.
- The tour step targets use CSS selectors tied to the header markup; renaming `#btnSearch`, `#btnHelp` or the `data-tab` attributes breaks it (the smoke test will catch this).
- The export caps quoted on the home page (about 10,000 messages with media, 40,000 without) are WhatsApp's behaviour as commonly documented; verify against the current WhatsApp help centre when editing that copy.

## Backlog (suggested order)

1. Fix the five parser gaps above (start with the group-name participant), then add a hand-anonymised real iOS export and non-English attachment lines.
2. A tiny synthetic zip with a few real image/video/audio files, to cover the media paths in the smoke test.
3. Light theme and a `prefers-color-scheme` switch.
4. Make `fmtN` locale configurable.
5. Export a Wrapped summary as a single image, and a print-friendly Overview.
6. Cross-browser smoke run (Firefox, WebKit via Playwright).
