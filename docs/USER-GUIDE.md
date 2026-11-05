# Threadline user guide

The same content is built into the app (the **?** button, or press `?`). Keep the two in sync.

## 1. Get your chat out of WhatsApp

Do this on your phone, one chat at a time. WhatsApp on the desktop can't export.

**Android:** open the chat → ⋮ → More → Export chat → choose *Include media* (everything) or *Without media* (text only, much smaller).

**iPhone:** open the chat → tap the contact or group name → Export Chat → *Attach Media* or *Without Media* → Save to Files, AirDrop or Mail.

WhatsApp caps exports at roughly the latest 10,000 messages with media, or 40,000 without. For a long chat, a text-only export covers far more history.

Move the file to the device where you'll use Threadline (or open Threadline on your phone and pick it from Files).

## 2. Open it

Drop the `.zip` on the page, or tap the drop zone to choose it. You don't need to unzip it. If you did, drop the `.txt` and the media files together.

For a two-person or group chat Threadline asks **which one is you**. Your side becomes "You", in teal. Change it any time from the ⋯ menu → *Change who is "You"*.

No export handy? Press **Try a demo chat** for a made-up conversation.

## 3. The views

- **Overview**: head-to-head stats (groups get a sortable leaderboard and a who-replies-to-whom matrix), highlights, daily rhythm, weekday pattern, busiest days, signature words and emoji.
- **Timeline**: messages per month, reply-speed and message-length trends, and a card per month with top words, a best quote and photos. *Read* opens that month in the chat.
- **Calendar**: a year heatmap plus a month grid. Tap a day to read it.
- **Media**: every photo, video, audio, sticker, document and contact. Search by caption, nearby conversation, tags, notes or date. Open an item to tag it and add a note. *Select* lets you download many as a `.zip`.
- **Links**: every link, grouped by site type, with the surrounding conversation. Tag, copy or export to CSV.
- **Chat**: the whole conversation with in-chat search, jump-to-date and inline media.
- **Wrapped**: seven story-sized (1080×1920) cards. Download one or all. Switch on *Hide names* before posting publicly.

Tap anything that looks tappable. Days open that day's messages, words search the chat, bars jump to a month, media tiles open a viewer with context.

## 4. What the numbers mean

| Number | Meaning |
| --- | --- |
| Conversation started | First message after a quiet gap of 6 hours or more. |
| Median reply time | Typical wait before answering the other person. Only replies within 6 hours count. Lower is faster. |
| Messages per turn | Messages in a row before the other person speaks. High means double-texting. |
| Active days | Days with at least one message. *Longest streak* is the most consecutive active days; *longest silence* is the longest run with none. |
| Night owl | Messages between midnight and 5am. |
| Laughs | Messages with haha, lol, lmao, rofl or a laughing emoji. |
| Questions | Messages ending in a question mark. |
| Signature words | Most-used words after removing common filler (English and Hinglish). |
| Heatmap colour | In a two-person chat, each day leans toward whoever sent more. |

## 5. Search and shortcuts

| Key | Action |
| --- | --- |
| `/` or `Ctrl/⌘ K` | Search messages, media, links, tags and notes together. Filter by type, person and dates. `Enter` opens the first result. |
| `?` | Open the guide |
| `Esc` | Close the current panel, dialog, menu, tour or search |
| `←` `→` | Previous/next photo in the viewer; previous/next Wrapped card |
| `Enter` / `Shift+Enter` | In Chat search: next older / newer match |

## 6. Privacy and storage

- Your export is read and analysed inside the browser tab. Nothing is uploaded; the app makes no network requests.
- To let you reopen a chat, it is saved in your browser's own storage on this device. Saved chats are listed on the home page.
- **Forget** deletes the chat, its media, your tags and your notes from this browser. Your original export is never touched.
- Clearing site data, or using a private window, also removes saved chats.

## 7. Troubleshooting

| Problem | Fix |
| --- | --- |
| "No chat text file found" | Drop the `.zip` as WhatsApp made it, or the `.txt` together with its media. A folder or a zip-inside-a-zip won't work. |
| "No messages found" | It isn't a WhatsApp export, or has an unusual layout. Re-export with WhatsApp's *Export chat*. |
| Media says "Not exported" | The export was "Without media", or WhatsApp dropped older files due to its cap. Re-export with *Include media*. |
| The wrong person is "You" | ⋯ menu → *Change who is "You"*. |
| Day and month look swapped | The date order is auto-detected. Very short chats where every day is 12 or below can be ambiguous; try a longer span. |
| Names show as phone numbers | WhatsApp uses the number when the person isn't in your contacts. |
| "This browser can't unzip natively" | Use a current Chrome, Edge, Safari or Firefox, or unzip it yourself and drop the files. |
| "Saving offline failed" | Storage is blocked (private window) or full. Everything works; you'll import again next time. |
| Slow on a huge export | Exporting without media is much faster. Media loads lazily; the first parse of a very large chat takes a few seconds. |
