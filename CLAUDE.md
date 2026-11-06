# Threadline

A WhatsApp chat-export analyser. One static file, `index.html` (~1,900 lines: CSS, markup and JS inline), no build step, no dependencies, no server. The user drops a WhatsApp export (.zip, or .txt plus media) and gets Overview, Timeline, Calendar, Media, Links, Chat and "Wrapped" views, all computed in the browser.

Open `index.html` directly in a browser, or serve the folder with any static server. That is the whole dev loop.

## Non-negotiable invariants

1. **No network, ever.** The product promise is "nothing is uploaded". The code makes zero `fetch`/XHR/WebSocket/beacon calls and loads no external scripts, fonts or images. Do not add any, including analytics, CDNs, web fonts and error reporting. Check with `grep -nE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|<script src|<link rel" index.html` (should print nothing).
2. **Single file, zero dependencies.** Keep it deployable by copying one file. No bundler, no npm runtime deps. `tools/` is dev-only.
3. **Escape everything user-derived.** Chat text, sender names, filenames and notes are untrusted. Route them through `esc()` before interpolating into template strings. `data-tip` attributes are written back with `innerHTML` by the tooltip handler, so escape them too (and keep tips plain text).
4. **Real exports never enter the repo.** `.gitignore` blocks `*.zip`, `WhatsApp Chat*`, `_chat.txt`. Test with synthetic data only (`tools/make-sample-chat.mjs` or the in-app demo).

## Commands

```bash
node tools/make-sample-chat.mjs out.txt [--group]   # synthetic Android-format export
node --test "tests/*.test.cjs"                      # parser/stats unit tests, no browser or deps (Node 22+)
node tools/smoke.cjs                                # headless end-to-end check (needs playwright + chromium)
SHOTS=/some/dir node tools/smoke.cjs                # same, plus screenshots
```

Cheap syntax check of the inline script, without a browser:

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');require('fs').writeFileSync('/tmp/app.js',s.match(/<script>([\s\S]*)<\/script>/)[1])" && node --check /tmp/app.js
```

Unit tests load `CORE()` straight out of `index.html` (`tests/load-core.cjs` slices from `function CORE(){` to `const CORE_API=CORE();`), so keep those two markers intact. Fixtures are in `tests/fixtures.cjs`; invisible characters (LRM, narrow nbsp) are written as `\u` escapes there. When you change parsing or stats, add or adjust a test first.

`tools/smoke.cjs` exits non-zero on any failed check or any console/page error. Run it after every change to `index.html`. Chromium and Playwright are preinstalled in Claude Code cloud sessions; elsewhere `npm i -D playwright && npx playwright install chromium`.

CI (`.github/workflows/test.yml`) runs on every PR and push to `main`: syntax check, the no-network grep, unit tests, then the Playwright smoke test (Playwright is pinned there and installed with `--no-save`; screenshots are uploaded as an artifact). Keep the workflow's grep in step with the one above.

## Code map (search by name; line numbers drift)

`index.html` is organised by `/* ---------- section ---------- */` comments, in this order:

- **CSS** in `<style>`. Design tokens live in `:root` (`--a` teal, `--b` violet, `--mut`/`--dim` text greys). Onboarding/help styles are the block commented `onboarding & help (v2)` at the end.
- **Markup**: `#home` (landing + onboarding content), `#appv` (app shell: `header.top`, `#demoBar`, `<main>` with one `section.view#v-<tab>` per tab), `#lb` (lightbox), `#tip` (tooltip).
- **Helpers**: `$`, `$$`, `esc`, formatters (`fmtN`, `fmtDate`, `fmtDur`…), icon table `IC` plus `ic(name)`, `toast`, `loader`, `modal`, `confirmBox`, `saveBlob`.
- **ZIP**: `readZip` (central directory + lazy `File.slice` entries, `DecompressionStream` to inflate), `makeZip` (store-only writer used for bulk downloads and Wrapped).
- **`DB`**: IndexedDB wrapper, database `threadline` v1, stores `chats`, `files`, `notes`.
- **`CORE()`**: parsing and statistics (`parseChat`, `attachMedia`, `computeStats`). **It is stringified into a Web Worker** (`runCore`), so it must stay self-contained: no references to anything outside its own body. It falls back to the main thread if Workers are unavailable.
- **Context/links**: `buildContext` (nearby messages and keywords per media item), `buildLinks`, `linkKind`, `parseVcf`.
- **State** `S` (`S.chat`, `S.tab`, `S.rendered`), per-view state objects `OV`, `MV`, `LV`, `CV`, `CAL`, `TR`, `WR`, `SE`.
- **Loading flow**: `handleFiles` → `openChat` → `setMe`/`askMe` → `buildContext` → `showApp`; `showHome`, `renderSaved`.
- **Views**, each `renderX()` writing `innerHTML` once, lazily, via `switchTab`: `renderOverview`, `renderTimeline`, `renderCalendar`, `renderMedia`, `renderLinks`, `renderChat`, `renderWrapped`. Plus the lightbox (`openLB`), search (`openSearch`/`runSearch`) and the Wrapped canvas cards (`WR_CARDS`).
- **Onboarding & help** (end of script): `makeDemoText`/`loadDemo`, `showProblem`, `GUIDE`/`openGuide`, `openMenu`/`changeMe`, `HINTS`/`addHint`, `TOUR`/`startTour`/`endTour`, and the wiring block.
- **Boot**: `renderSaved()` as the last statement.

More detail in `docs/ARCHITECTURE.md`.

## Behaviour worth knowing

- **Date order** (`dmy`/`mdy`/`ymd`) is inferred in `parseChat`: a 4-digit first field means `ymd`; otherwise any day value over 12 decides; otherwise whichever order produces fewer backwards timestamps. Very short chats with every day ≤ 12 can be ambiguous.
- **iOS generated lines.** iOS starts bodies WhatsApp wrote itself (notices, calls, media placeholders) with U+200E. `parseChat` uses that mark (`gen`) to tell a group-name "sender" from a person; keep the `pend` resolution after the loop in step if you touch it. `SYS` (notice wording) is applied only to LRM-prefixed bodies, so a person's typed sentence is never read as a notice. These heuristics are English-only and documented in `docs/STATUS.md`.
- A "conversation start" is the first message after a **6-hour** gap (`GAP`). Reply times only count gaps under that. Median, not mean.
- Senders can be a phone number when the contact isn't saved. "You" is chosen by the user once (`askMe`) and stored on the saved chat record; `changeMe` re-renders everything.
- Media rows have `status`: `ok` (file present), `missing` (referenced but absent), `omitted` (WhatsApp wrote "<Media omitted>"), plus orphan files with no message. The UI calls the last three "Not exported".
- Chats over 500 MB prompt before being saved to IndexedDB. The demo chat (`id:'demo'`) is never persisted.
- Wrapped cards are drawn on a 1080×1920 canvas; "Hide names" swaps names for generic labels.
- Downloads use `window.claude.use('downloads')` when hosted as a Claude artifact, otherwise an `<a download>` click (`saveBlob`).

## Browser storage keys

`localStorage`: `threadline.tour.v1` (tour completed), `threadline.hint.<tab>` (tip dismissed). IndexedDB `threadline`: saved chats, media blobs, tags/notes. All access is wrapped in try/catch because storage can be blocked.

## UI conventions

- Compact, dense JS style: arrow functions, template-literal HTML, short names. Match it; do not reformat existing code.
- Dark theme only. Use the CSS tokens; keep body text ≥ 4.5:1 contrast (`--dim` was raised for this).
- Every new interactive element needs a visible `:focus-visible` state (global rule exists), an accessible name (`aria-label` for icon-only buttons), and must work on a 390 px-wide phone. The tab bar becomes a fixed bottom bar under 720 px.
- Overlays: use `modal(html, cls)`; Esc dispatches a `dismiss` event on the topmost `.ov`. Any promise-returning modal **must** listen for `dismiss` and resolve, otherwise Esc strands the caller (this was a real bug in `askMe`).
- Anything new a first-time user must understand goes in three places: the in-app `GUIDE`, `docs/USER-GUIDE.md`, and, if it is a number, `METRIC_TIPS`.

## Before you finish a change

1. `node --test "tests/*.test.cjs"` and `node tools/smoke.cjs` pass (add a test for new behaviour).
2. The no-network grep above is empty.
3. Open it at desktop and 390 px width and look at the screenshots (`SHOTS=…`). Assertions miss visual regressions.
4. Update `docs/STATUS.md` if you fixed or discovered a known issue.
