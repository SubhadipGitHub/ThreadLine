# Threadline

Your WhatsApp chat, decoded. Drop in a chat export and explore it as a timeline, a calendar, head-to-head stats (or a group leaderboard), a searchable media vault, a links library, a readable chat and shareable "Wrapped" story cards.

**Private by construction.** Threadline is one static HTML file. It reads your export inside the browser tab, makes no network requests, and stores nothing anywhere except your own browser's storage, and only so you can reopen a chat later.

## Try it

Open `index.html` in a modern browser (Chrome, Edge, Safari or Firefox), or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

No install, no build. Click **Try a demo chat** to explore with made-up messages, or drop in a real export.

## Getting an export

On your phone, one chat at a time:

- **Android:** open the chat → ⋮ → More → Export chat → *Include media*.
- **iPhone:** open the chat → tap its name → Export Chat → *Attach Media*.

Drop the resulting `.zip` into Threadline without unzipping it. (If you already unzipped it, drop the `.txt` and the media files together.) WhatsApp caps exports at roughly the latest 10,000 messages with media, or 40,000 without.

## What you get

| View | What it's for |
| --- | --- |
| Overview | Who talks more, replies faster, starts conversations; busiest days; signature words and emoji. Groups get a sortable leaderboard and a reply matrix. |
| Timeline | Month-by-month chart, reply-speed and message-length trends, a card per month. |
| Calendar | Year heatmap and month grid; tap a day to read it. |
| Media | Photos, videos, audio, documents and contacts. Search, tag, annotate, bulk-download as .zip. |
| Links | Every shared link, grouped by site, with surrounding conversation. CSV export. |
| Chat | The full conversation with search, jump-to-date and inline media. |
| Wrapped | Seven 1080×1920 story cards. Download one or all. Optional "hide names". |

First-time help is built in: a guided tour on your first chat, a tip at the top of each view, hover explanations on every stat, and a Guide (`?`) covering metrics, shortcuts and troubleshooting. See [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md).

## Privacy

- No network calls, no analytics, no external fonts or scripts.
- Saved chats live in your browser's IndexedDB. **Forget** deletes a chat, its media, tags and notes. Your original export is never modified.
- Wrapped cards are drawn locally and contain stats, not message text (apart from top words and emoji).

## Development

```bash
node tools/make-sample-chat.mjs sample.txt --group   # synthetic export (DM by default)
node --test "tests/*.test.cjs"                       # parser and stats unit tests (Node 22+, no install)
node tools/smoke.cjs                                 # headless end-to-end test (needs playwright)
```

Read [`CLAUDE.md`](CLAUDE.md) for the ground rules and code map, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it works, and [`docs/STATUS.md`](docs/STATUS.md) for what is verified, what is not, and the backlog.

Real chat exports must never be committed; `.gitignore` blocks the usual filenames.
