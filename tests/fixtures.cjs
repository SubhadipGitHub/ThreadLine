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

// ---------------------------------------------------------------------------------------------------------------
// Documented real-export shapes.
// PROVENANCE: no real export is available to this repo (and real exports must never be committed). These lines
// reproduce shapes that two independent parser authors document from real iOS/Android exports:
//   https://neverfar.app/whatsapp-export-format            (checked 2026-11-06)
//   https://chat-recap.com/en/guides/whatsapp-export-file-format   (checked 2026-11-06)
// Names, numbers and text are invented. Treat the shapes as "observed by others", not as verified by us.
// ---------------------------------------------------------------------------------------------------------------
const BOM = '﻿', LRE = '‪', PDF = '‬';

// iOS with a UTF-8 BOM and CRLF line endings (both documented for iOS round-trips).
exports.iosBomCrlf = BOM + [
  `${L}[05/10/2026, 09:32:15] Marta: Who's booking the restaurant?`,
  `[05/10/2026, 09:33:02] Anna: me`,
  `[05/10/2026, 09:34:40] Anna: But first`,
  `I need to finish work`,
  ``,
  `and then I'll come`,
].join('\r\n') + '\r\n';

// iOS group notices are attributed to the GROUP NAME and the body starts with an LRM.
exports.iosGroupNotices = [
  `[05/10/26, 09:30:02] Sunday Dinners: ${L}Marta created group "Sunday Dinners"`,
  `[05/10/26, 09:30:03] Sunday Dinners: ${L}Marta added Anna`,
  `[05/10/26, 09:31:00] Marta: hello`,
  `[05/10/26, 09:32:00] Anna: hi`,
].join('\n') + '\n';

// Call lines have an author, but nobody "wrote" them.
exports.iosCall = [
  `[01/03/26, 10:00:00] Anna: ok call me`,
  `[01/03/26, 10:01:00] Pau: ${L}Missed voice call. ${L}Click to call back`,
  `[01/03/26, 10:02:00] Anna: sorry`,
].join('\n') + '\n';

// Polls are multi-line blocks: the option lines carry no header, so they continue the poll message.
exports.iosPoll = [
  `[01/03/26, 10:04:00] Anna: ${L}POLL:`,
  `Where shall we eat?`,
  `${L}OPTION: Pizza place (3 votes)`,
  `${L}OPTION: Someone's house (0 votes)`,
  `[01/03/26, 10:05:00] Pau: pizza!`,
].join('\n') + '\n';

// Sender stored as a phone number wrapped in directional embeddings (U+202A … U+202C), plus the "~ " prefix.
exports.iosPhoneSenders = [
  `[05/10/26, 09:30:00] ${LRE}+1 (555) 010-0000${PDF}: hi`,
  `[05/10/26, 09:31:00] ~ ${LRE}+1 (555) 010-0000${PDF}: again`,
  `[05/10/26, 09:32:00] Marta: hello`,
].join('\n') + '\n';

// Android, Spanish locale: "p. m." with dots and a space inside the marker.
exports.androidEsPm = [
  `5/10/26, 9:15 p. m. - Marta: buenas noches`,
  `5/10/26, 11:59 p. m. - Anna: hasta mañana`,
  `6/10/26, 12:05 a. m. - Marta: ya es tarde`,
].join('\n') + '\n';

// Android: a notice whose new group name contains ": " (documented to fool naive parsers).
exports.androidSubjectColon = [
  `14/10/2026, 00:09 - Marta: night`,
  `14/10/2026, 00:10 - Marta changed the subject from "Sunday Dinners" to "Dinners: season 2"`,
  `14/10/2026, 00:11 - Anna: ok`,
].join('\n') + '\n';

// A header with an impossible calendar date; documented parsers reject these instead of rolling into March.
exports.impossibleDate = [
  `[28/02/2026, 10:00:00] Anna: fine`,
  `[31/02/2026, 10:00:00] Anna: impossible date`,
  `[01/03/2026, 10:00:00] Anna: fine again`,
].join('\n') + '\n';
