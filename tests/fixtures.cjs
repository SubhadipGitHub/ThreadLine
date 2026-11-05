// Synthetic iOS-style WhatsApp exports. Invisible marks are written as escapes so they survive editors:
//   ‎ = LEFT-TO-RIGHT MARK (iOS puts it before system lines, media and many bodies)
//     = NARROW NO-BREAK SPACE (newer iOS puts it before AM/PM)
const L = '‎', N = ' ';

// 24-hour, day-first. Hand-checked numbers are asserted in parser.test.cjs.
exports.iosDm24 = [
  `${L}[25/12/2024, 09:00:00] Asha: Good morning`,
  `[25/12/2024, 09:02:00] Rahul: morning!`,
  `[25/12/2024, 09:03:00] Rahul: slept ok?`,
  `[25/12/2024, 09:10:00] Asha: yes 😂`,
  `[25/12/2024, 23:30:00] Rahul: night owl?`,
  `[26/12/2024, 00:30:00] Asha: haha yes`,
  `${L}[26/12/2024, 00:31:00] Asha: ${L}<attached: 00000012-PHOTO-2024-12-26-00-31-00.jpg>`,
  `[27/12/2024, 10:00:00] Rahul: https://youtu.be/dQw4w9WgXcQ`,
].join('\n') + '\n';

// US-style 12-hour with narrow nbsp, 2-digit year, month-first (31 > 12 proves it), continuation lines.
exports.iosDm12Us = [
  `${L}[12/31/24, 11:59:30${N}PM] Asha: Happy new year!`,
  `${L}[1/1/25, 12:00:05${N}AM] Rahul: midnight!`,
  `and a second line`,
  `and a third`,
  `${L}[1/1/25, 12:30:00${N}PM] Asha: noon`,
].join('\n') + '\n';

// German-locale iOS: dots as separators, 24h, group chat, system lines without "Sender:".
exports.iosGroupDe = [
  `${L}[25.12.24, 14:00:00] ${L}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`,
  `[25.12.24, 14:00:01] ${L}Asha created group “Family”`,
  `[25.12.24, 14:05:09] ~ Asha: hallo`,
  `[25.12.24, 14:06:00] ~ Rahul: hi`,
  `[25.12.24, 14:07:00] Meera: hey all`,
  `[25.12.24, 14:08:00] ~ Asha: replying to meera`,
  `[25.12.24, 14:09:00] Meera: Note: this has a colon in the body`,
].join('\n') + '\n';

// iOS media / system line variants
exports.iosMedia = [
  `[26/12/2024, 09:01:00] Asha: ${L}IMG-1.jpg (file attached)`,
  `[26/12/2024, 09:02:00] Asha: ${L}sticker omitted`,
  `[26/12/2024, 09:03:00] Asha: ${L}audio omitted`,
  `[26/12/2024, 09:04:00] Asha: ${L}video omitted`,
  `[26/12/2024, 09:05:00] Asha: ${L}image omitted`,
  `[26/12/2024, 09:06:00] Asha: ${L}contact card omitted`,
  `[26/12/2024, 09:07:00] Asha: This message was deleted.`,
  `[26/12/2024, 09:08:00] Rahul: You deleted this message.`,
  `[26/12/2024, 09:09:00] Rahul: fixed typo ${L}<This message was edited>`,
  `[26/12/2024, 09:10:00] Rahul: location: https://maps.google.com/?q=12.97,77.59`,
  `[26/12/2024, 09:11:00] Rahul: ${L}<attached: STK-20241226-WA0001.webp>`,
  `[26/12/2024, 09:12:00] Rahul: ${L}<attached: PTT-20241226-WA0002.opus>`,
].join('\n') + '\n';

// Every day ≤ 12, so the day/month fields can't decide the order. Each fixture is chronological in ONE reading
// only (the other reading steps backwards in time), which is what the parser's inversion count uses.
exports.ambiguousDmy = [      // day-first: 10 Jan, 11 Jan, 12 Jan, 1 Feb …  (month-first would go Oct, Nov, Dec, then back to Jan)
  `[10/01/2024, 10:00:00] Asha: a`, `[11/01/2024, 10:00:00] Rahul: b`, `[12/01/2024, 10:00:00] Asha: c`,
  `[01/02/2024, 10:00:00] Rahul: d`, `[02/02/2024, 10:00:00] Asha: e`,
].join('\n') + '\n';

exports.ambiguousMdy = [      // month-first: Jan 2, Jan 5, Jan 9, Feb 3 …   (day-first would go 1 Feb, 1 May, 1 Sep, then back to 2 Mar)
  `[01/02/2024, 10:00:00] Asha: a`, `[01/05/2024, 10:00:00] Rahul: b`, `[01/09/2024, 10:00:00] Asha: c`,
  `[02/03/2024, 10:00:00] Rahul: d`, `[02/11/2024, 10:00:00] Asha: e`,
].join('\n') + '\n';

// Chronological in BOTH readings (2 Jan, 2 Feb … vs Feb 1, Feb 2 …): genuinely undecidable.
exports.ambiguousTie = [
  `[01/02/2024, 10:00:00] Asha: a`, `[02/02/2024, 10:00:00] Rahul: b`, `[03/02/2024, 10:00:00] Asha: c`,
].join('\n') + '\n';
