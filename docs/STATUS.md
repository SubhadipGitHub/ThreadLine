# Status

Audit date: 2026-11-05. State of `index.html` after the onboarding/UX overhaul.

## Verified (automated, `tools/smoke.cjs`, Chromium)

- Parses a synthetic Android-format export for a 2-person and a 4-person chat (~2,900 lines); every tab renders; no console or page errors.
- Save to IndexedDB and reopen from the home list.
- Demo chat, first-run tour (10 steps, desktop and 390 px), tips, guide, ⋯ menu, "change who is You", friendly errors for a non-chat `.txt` and for a drop with no `.txt`.
- No horizontal overflow on home or app at 390 px.
- Zero network-capable calls in the source (grep in `CLAUDE.md` returns nothing).

## Not verified, so don't assume it works

- **Real iOS exports.** `tests/parser.test.cjs` covers iOS-style headers with synthetic fixtures (24h, US 12h with narrow nbsp, dotted dates, LRM marks, `<attached:>`, `omitted`, deleted/edited), but the fixtures were written from knowledge of the format, not taken from a real export. Treat them as likely-correct, not proven.
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
- Older iOS document lines (`name.pdf • 2 pages document omitted`) are parsed as plain text, not as an omitted document. Recorded as a `todo` test; the line format is unverified against a real export.
- `renderTimeline` adds a click listener to its container each time it renders. `changeMe` works around this by replacing the view nodes; any new code that re-renders a view should do the same or use delegation.
- IndexedDB is at schema v1 with no migration path.
- `index.html` is ~1,900 lines and will keep growing. The parser (`CORE`) is the obvious first thing to extract into a testable module, but doing so conflicts with the single-file rule; if you do it, keep a build step that re-inlines it.
- The tour step targets use CSS selectors tied to the header markup; renaming `#btnSearch`, `#btnHelp` or the `data-tab` attributes breaks it (the smoke test will catch this).
- The export caps quoted on the home page (about 10,000 messages with media, 40,000 without) are WhatsApp's behaviour as commonly documented; verify against the current WhatsApp help centre when editing that copy.

## Backlog (suggested order)

1. Extend parser tests with real-export-derived fixtures (replace the synthetic iOS ones) and non-English attachment lines.
2. A tiny synthetic zip with a few real image/video/audio files, to cover the media paths in the smoke test.
3. Light theme and a `prefers-color-scheme` switch.
4. Make `fmtN` locale configurable.
5. Export a Wrapped summary as a single image, and a print-friendly Overview.
6. Cross-browser smoke run (Firefox, WebKit via Playwright).
