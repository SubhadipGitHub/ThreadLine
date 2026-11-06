# Turning a real export into a test fixture

The parser is only proven against synthetic data (see `docs/STATUS.md`). `tools/sanitize-export.mjs` anonymises a real export so it can be committed as a fixture. It runs **locally** and makes no network calls. Run it yourself; do not paste a real export into a chat, issue or pull request.

```bash
node tools/sanitize-export.mjs "WhatsApp Chat with Someone.zip"        # writes ./sanitized-chat.txt
node tools/sanitize-export.mjs _chat.txt --out /tmp/anon.txt            # a bare .txt works too
```

Options: `--seed S` (reproducible output), `--shift-days N` or `--keep-dates`, `--no-hosts` (turn every link into `example.com`), `--force` (write even if verification failed; don't).

It reads the chat text from the zip and ignores the media files. The default output name `sanitized-chat.txt` is git-ignored on purpose, so an accidental `git add -A` cannot commit unreviewed output.

## What it does

It keeps only the **structure** the parser cares about and rebuilds everything else from a closed vocabulary.

| Kept exactly | Replaced |
| --- | --- |
| Header: bracket style, separators, 12/24-hour clock, `AM`/`PM` marker, narrow no-break spaces, invisible marks (LRM etc.), `~ ` prefixes | Senders become `Person A`, `Person B`…; the iOS group name used as a "sender" becomes `Group` |
| Time of day, line breaks, BOM, CRLF/LF | Dates are shifted by a whole number of days (default: a random 180 to 900 days into the past) |
| Placeholders: `<Media omitted>`, `image omitted`, `This message was deleted.`, `<This message was edited>`, `Missed voice call` | Message text becomes filler words of the same length and case; punctuation, `?`, emoji, `*bold*` marks and numbers' shape are kept |
| Attachment *type* patterns (`…-PHOTO-…jpg`, `IMG-…-WA0001.jpg (file attached)`, `• 3 pages`) | Digits become `0` (except small counts next to `pages`, `votes`, `min`…); file names become `Document1.pdf`; emails become `user@example.com` |
| `POLL:` / `OPTION:` markers, `location:` prefix | Links become `https://<host>/x` (host kept only if it is a well-known public one such as `youtube.com`, else `example.com`) |
| Known notice shapes ("X created group…", "X added Y", disappearing messages, security code…) | Names inside notices become `Person N`; group names become `Group`; any notice it does not recognise becomes `<unrecognised notice replaced by sanitizer>` |

Because it is built from an allowlist, an unexpected kind of line is **replaced**, not passed through.

## Built-in verification (and why you still must read the output)

After rewriting, the tool checks the *output* independently: every word must come from the allowlist (filler, fixed notice wording, placeholders), no original name token may appear, no long digit run containing a non-zero digit may survive, no email-like token may remain. If anything fails it exits 1 and writes nothing. A rare false alarm (a name that equals a filler word, such as someone called "Lorem") is fixed by re-running with another `--seed`.

**The tool cannot judge your content.** Before committing, open the output and read every line.

## What it deliberately does not hide

- **The shape of the conversation**: message counts, who replies to whom and how fast, time of day, word lengths, emoji, laughing and question patterns. Someone who knows the original chat could recognise it. That is what makes it a useful fixture.
- **Emoji** are kept (they are content).
- **Well-known link hosts** are kept by default, which reveals *that* a YouTube or Maps link was shared (never which one). Use `--no-hosts` to drop even that.
- Non-Latin text becomes Latin filler (same length), so right-to-left and non-English *wording* is not preserved. This tool therefore cannot create non-English notice fixtures.
- Notice templates are **English only**; other languages' notices are replaced by the placeholder line.

## Before you commit

1. Read the whole file. Look for anything that could identify a person, place, employer, account or event.
2. Check the dates still look plausible and the placeholders (`Group`, `Person A`) read sensibly.
3. Save it under `tests/fixtures/`, give it a neutral name, and add a test that parses it (see `tests/parser.test.cjs` for the pattern). Record in `docs/STATUS.md` which platform, locale and WhatsApp version it came from.
4. `node --test "tests/*.test.cjs"` and, if you edited `index.html`, `node tools/smoke.cjs`.

If in doubt, don't commit it. An unreviewed fixture is a permanent leak in git history.
