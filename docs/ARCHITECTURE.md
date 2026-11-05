# Architecture

Threadline is a client-only app in one HTML file. There is no framework: each view is a function that builds an HTML string once, assigns it to a container's `innerHTML`, and wires events by delegation or direct handlers.

## Data flow

```
 file(s) dropped / chosen
        │
 handleFiles ── .zip? ─► readZip (central directory only; entries are lazy File.slice) ─► inflate on demand
        │                                    └ .txt + media files go straight into a Map<name, Blob>
        ▼
 pick chat .txt  (prefers "WhatsApp Chat…" / "_chat.txt", else the largest .txt)
        │
 openChat ─► runCore(text, fileNames)   ── Web Worker (CORE() stringified into a Blob URL) ──┐
        │        parseChat → attachMedia → computeStats                                      │ fallback: main thread
        ▼                                                                                    ┘
 askMe (which sender is "you")  → setMe  → buildContext (media keywords, nearby messages) → buildLinks
        │
 showApp ─► switchTab('overview') ─► autoTour (first run only)
        │
 DB.putChat + DB.putFiles   (IndexedDB; skipped for the demo and for >500 MB unless confirmed)
```

Only the chat text and file *names* cross into the worker. Media blobs stay on the main thread and are loaded lazily into `<img>/<video>` via an `IntersectionObserver` (`hydrate`) and object URLs (`urlFor`), which are revoked in `closeChat`.

## Parsing (`parseChat`)

1. Split into lines. A line matching the Android (`d/m/y, h:mm am - …`) or iOS (`[d/m/y, h:mm:ss] …`) header regex starts a message; any other line continues the previous one. The regexes tolerate narrow no-break spaces, LTR marks, `a.m.`/`p.m.`, and `.`/`-`/`/` date separators.
2. Infer date order (see `CLAUDE.md`).
3. Split `Sender: body` on the first `": "` within 80 chars; otherwise the line is a system message (`type:'system'`). Known system phrases (`SYS`) are also treated as system.
4. Classify body: deleted, media attachment (`name.ext (file attached)` in several languages, or `<attached: name>`), omitted media (`<Media omitted>` etc.), location link, edited marker.
5. `attachMedia` joins message attachments to the file map and appends orphan files (files in the export that no message references), dated from the filename when it contains `YYYYMMDD`.

## Statistics (`computeStats`)

One pass over messages building per-sender counters (messages, words, media, links, starts, reply gaps, turns, night messages, questions, laughs, deleted/edited, emoji and word maps, hour and weekday histograms), per-month and per-day buckets, a who-replies-to-whom matrix, longest streak and silence, and top days. A conversation start is a message after a gap ≥ `GAP` (6 h); a reply is a sender change with a smaller gap.

## Views

| Tab | Function | Notes |
| --- | --- | --- |
| overview | `renderOverview` | Two-person: VS card (`METRIC_TIPS` give hover help). Group (>2 senders): sortable `boardHTML` + `matrixHTML`. |
| timeline | `renderTimeline`, `drawTrends` | SVG bars; trends are smoothed monthly series (`TR`). |
| calendar | `renderCalendar`, `drawHeat`, `drawMonth` | SVG year heatmap + CSS-grid month. `openDay` opens a drawer. |
| media | `renderMedia`, `mediaApply` | Filtered grid, selection mode, `downloadSelected` via `makeZip`. |
| links | `renderLinks`, `linksApply` | `linkKind` classifies hosts; `linksCsv` exports. |
| chat | `renderChat`, `chatRender`, `extendUp/Down` | Windowed rendering in chunks; `chatShow(i)` jumps to a message. |
| wrapped | `renderWrapped`, `WR_CARDS` | Canvas 2D; cards are plain functions `(ctx, data, index)`. |

`switchTab` renders each view at most once (`S.rendered`) and then calls `addHint`. The URL hash mirrors the tab so a refresh or share keeps your place.

## Overlays

`modal()` (dialogs), the drawer (day / link detail), the lightbox `#lb`, the search panel `#sov`, the ⋯ `#menu`, and the tour (`#tourBlk/#tourHl/#tourPop`). Esc is handled centrally; precedence is search → menu → tour → lightbox → drawer → modal. Promise-returning modals resolve on the `dismiss` event.

## Onboarding layer

- **Home**: static markup (steps, export instructions with Android/iPhone tabs, privacy cards, FAQ), the drop zone, a demo button and the saved-chats list.
- **Demo**: `makeDemoText()` generates ~4,000 messages of fictional Android-format text with a fixed seed, so it is deterministic and goes through the real parser. It is opened with `fresh:false`, so it is never persisted.
- **Tour**: `TOUR` is an array of steps `{tab, sel, t, b}`. `tourPlace` positions a spotlight (`box-shadow` spread) and a popover next to the target, flipping above/below and clamping to the viewport; falls back to a centred card when the target is hidden. Completion is remembered in `localStorage`.
- **Tips**: `HINTS` shows a dismissible strip at the top of Overview, Timeline, Calendar, Media and Links. Chat and Wrapped have none (Chat needs the vertical space; Wrapped has its own explainer).
- **Guide**: `GUIDE` sections rendered in a wide modal; opened from the home page, the header `?` button, the ⋯ menu, or the `?` key.
- **Errors**: `showProblem` maps `err.kind` (`notxt`, `empty`) to plain-language fixes and links to the troubleshooting section.

## Storage

IndexedDB `threadline` v1: `chats` (metadata + full text + chosen "you"), `files` (media blobs keyed `chatId|name`, indexed by chat), `notes` (tags and notes keyed `chatId|mediaKey`, indexed by chat). `DB.del` removes all three for a chat. A schema change needs an `onupgradeneeded` migration; there is none yet.

## Testing

`tools/smoke.cjs` drives Chromium through the home page, demo, tour, every tab, the menu, "change you", real-file load, error dialogs and a mobile pass, failing on any console or page error. There are no unit tests for the parser; see `docs/STATUS.md`.
