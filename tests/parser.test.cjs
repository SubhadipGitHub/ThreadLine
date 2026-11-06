// Unit tests for the parser and stats in CORE() (extracted from index.html by load-core.cjs).
//   node --test "tests/*.test.cjs"
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./load-core.cjs');
const F = require('./fixtures.cjs');

const parse = (t, files = []) => core.parseChat(t, new Set(files));
const local = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime(); // same TZ as the parser
const full = (t, files = []) => { const P = parse(t, files); const C = { files: new Map(files.map(n => [n, { size: 1 }])), ...P }; core.attachMedia(C); return { C, st: core.computeStats(C) }; };
const MIN = 60e3;

test('iOS 24h day-first: headers, senders, multi-line, attachment', () => {
  const { msgs, senders, order } = parse(F.iosDm24);
  assert.equal(order, 'dmy');
  assert.deepEqual(senders, ['Asha', 'Rahul']);
  assert.equal(msgs.length, 8);
  assert.equal(msgs[0].t, local(2024, 12, 25, 9, 0, 0));
  assert.equal(msgs[0].text, 'Good morning');          // leading LRM on the line is tolerated
  assert.equal(msgs[6].type, 'media');
  assert.equal(msgs[6].att, '00000012-PHOTO-2024-12-26-00-31-00.jpg');
  assert.equal(msgs[6].text, '');
});

test('iOS US 12-hour: month-first, 2-digit year, narrow nbsp, 12AM/12PM edges, continuation lines', () => {
  const { msgs, order } = parse(F.iosDm12Us);
  assert.equal(order, 'mdy');
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].t, local(2024, 12, 31, 23, 59, 30));  // 11:59 PM
  assert.equal(msgs[1].t, local(2025, 1, 1, 0, 0, 5));       // 12:00 AM is midnight, not noon
  assert.equal(msgs[2].t, local(2025, 1, 1, 12, 30, 0));     // 12:30 PM is noon-ish, not 00:30
  assert.equal(msgs[1].text, 'midnight!\nand a second line\nand a third');
});

test('iOS dotted dates (de), group: system lines, "~" prefix, colon inside body', () => {
  const { msgs, senders, order } = parse(F.iosGroupDe);
  assert.equal(order, 'dmy');
  assert.equal(msgs[0].type, 'system');                      // encryption notice
  assert.equal(msgs[1].type, 'system');                      // "created group" has no "Sender: "
  assert.deepEqual(senders, ['Asha', 'Rahul', 'Meera']);     // "~ " stripped from "~ Asha"
  assert.equal(msgs[6].s, senders.indexOf('Meera'));
  // split on the FIRST ": " only. trimEnd: the file's final blank line is appended to the last message as a
  // continuation, so the last message of any export ends with "\n" (harmless: HTML collapses it).
  assert.equal(msgs[6].text.trimEnd(), 'Note: this has a colon in the body');
  assert.equal(msgs[2].t, local(2024, 12, 25, 14, 5, 9));    // 2-digit year → 2024
});

test('iOS media, deleted, edited, location and sticker/voice-note naming', () => {
  const { msgs } = parse(F.iosMedia, ['IMG-1.jpg']);
  const by = i => msgs[i];
  assert.equal(by(0).type, 'media'); assert.equal(by(0).att, 'IMG-1.jpg');
  assert.deepEqual([1, 2, 3, 4, 5].map(i => [by(i).type, by(i).okind]),
    [['omitted', 'sticker'], ['omitted', 'audio'], ['omitted', 'video'], ['omitted', 'image'], ['omitted', 'contact']]);
  assert.equal(by(6).type, 'deleted');
  assert.equal(by(7).type, 'deleted');
  assert.equal(by(8).edited, true); assert.equal(by(8).text, 'fixed typo');
  assert.equal(by(9).loc, 'https://maps.google.com/?q=12.97,77.59');
  assert.equal(core.typeOf(by(10).att), 'sticker');
  assert.equal(core.typeOf(by(11).att), 'audio');
});

test('date-order inference when every day ≤ 12 uses chronology', () => {
  assert.equal(parse(F.ambiguousDmy).order, 'dmy');
  assert.equal(parse(F.ambiguousMdy).order, 'mdy');
  assert.equal(parse(F.ambiguousTie).order, 'dmy');          // true tie: falls back to day-first
  assert.equal(parse('[2024-12-25, 14:05:09] A: x\n[2024-12-26, 14:05:09] B: y\n').order, 'ymd');
});

test('Android 12h format with a.m./p.m. and dash separator still parses (regression guard)', () => {
  const { msgs, senders } = parse('25/12/2024, 9:05 pm - Asha: hello\n26/12/2024, 12:05 am - Rahul: late\n');
  assert.deepEqual(senders, ['Asha', 'Rahul']);
  assert.equal(msgs[0].t, local(2024, 12, 25, 21, 5));
  assert.equal(msgs[1].t, local(2024, 12, 26, 0, 5));
});

test('non-chat input yields no real messages', () => {
  const { msgs } = parse('hello\nthis is not a chat\n');
  assert.equal(msgs.filter(m => m.type !== 'system').length, 0);
});

test('attachMedia: ok / missing / omitted / orphan (dated from filename)', () => {
  const t = F.iosMedia + '[27/12/2024, 09:00:00] Asha: <attached: GONE.jpg>\n';
  const P = parse(t, ['IMG-1.jpg']);
  const C = { files: new Map([['IMG-1.jpg', { size: 1 }], ['IMG-20240301-WA0009.jpg', { size: 1 }]]), ...P };
  core.attachMedia(C);
  const byName = n => C.media.find(m => m.name === n);
  assert.equal(byName('IMG-1.jpg').status, 'ok');
  assert.equal(byName('GONE.jpg').status, 'missing');
  assert.equal(C.media.filter(m => m.status === 'omitted').length, 5);
  const orphan = byName('IMG-20240301-WA0009.jpg');
  assert.ok(orphan.orphan); assert.equal(orphan.mi, -1);
  assert.equal(orphan.t, local(2024, 3, 1));
});

test('computeStats on the iOS 24h fixture (hand-calculated)', () => {
  const { C, st } = full(F.iosDm24, []);
  const [A, R] = [C.senders.indexOf('Asha'), C.senders.indexOf('Rahul')];
  assert.equal(st.total, 8);
  assert.deepEqual([st.per[A].msgs, st.per[R].msgs], [4, 4]);
  assert.deepEqual([st.per[A].starts, st.per[R].starts], [1, 2]);          // 09:00; 23:30 (14h gap); 27th (33h gap)
  assert.deepEqual(st.per[A].replies, [7 * MIN, 60 * MIN]);                // 09:03→09:10, 23:30→00:30
  assert.deepEqual(st.per[R].replies, [2 * MIN]);                          // same-sender 09:03 is not a reply
  assert.equal(st.per[A].night, 2);                                        // 00:30 and 00:31
  assert.equal(st.per[A].media, 1);
  assert.equal(st.per[R].links, 1);
  assert.equal(st.per[R].q, 2);                                            // "slept ok?" and "night owl?"
  assert.equal(st.per[A].laugh, 2);                                        // 😂 and "haha"
  assert.equal(st.per[A].emo.get('😂'), 1);
  assert.equal(st.dayKeys.join(), '2024-12-25,2024-12-26,2024-12-27');
  assert.deepEqual({ len: st.streak.len, from: st.streak.from, to: st.streak.to }, { len: 3, from: '2024-12-25', to: '2024-12-27' });
  assert.equal(st.silence.len, 0);
  assert.equal(st.top[0][0], '2024-12-25'); assert.equal(st.top[0][1].n, 5);
  assert.equal(st.first, local(2024, 12, 25, 9, 0)); assert.equal(st.last, local(2024, 12, 27, 10, 0));
});

test('computeStats: gap handling, silence, deleted/edited and system messages excluded', () => {
  const t = `[01/01/2024, 10:00:00] A: one\n[01/01/2024, 10:05:00] B: two\n[05/01/2024, 10:00:00] A: back\n` +
            `[05/01/2024, 10:01:00] B: This message was deleted.\n[05/01/2024, 10:02:00] B: fixed ${'‎'}<This message was edited>\n[05/01/2024, 10:03:00] Messages and calls are end-to-end encrypted.\n`;
  const { C, st } = full(t);
  assert.equal(st.total, 5);                                // system line not counted
  assert.equal(st.silence.len, 3);                          // 2,3,4 Jan are silent
  assert.deepEqual([st.silence.from, st.silence.to], ['2024-01-01', '2024-01-05']);
  assert.equal(st.per[C.senders.indexOf('B')].del, 1);
  assert.equal(st.per[C.senders.indexOf('B')].edit, 1);
  assert.equal(st.per[C.senders.indexOf('A')].starts, 2);
});

test('group chat: who-replies-to-whom matrix', () => {
  const { C, st } = full(F.iosGroupDe);
  const [A, R, M] = ['Asha', 'Rahul', 'Meera'].map(n => C.senders.indexOf(n));
  assert.equal(C.senders.length, 3);
  assert.equal(st.total, 5);                                // the two system lines are excluded
  assert.equal(st.mat[R][A], 1);                            // Rahul replied to Asha
  assert.equal(st.mat[M][R], 1);                            // Meera replied to Rahul
  assert.equal(st.mat[A][M], 1);                            // Asha replied to Meera
  assert.equal(st.mat[M][A], 1);                            // Meera replied to Asha (last message)
});

// ---- Documented real-export shapes (see provenance note in fixtures.cjs) ----
test('iOS BOM + CRLF parses identically to the clean LF file; blank lines inside a message are kept', () => {
  const { msgs, senders } = parse(F.iosBomCrlf);
  assert.deepEqual(senders, ['Marta', 'Anna']);              // BOM did not break the first header or the first sender name
  assert.equal(msgs.length, 3);
  assert.equal(msgs[0].text, "Who's booking the restaurant?");
  assert.equal(msgs[2].text.trimEnd(), 'But first\nI need to finish work\n\nand then I\'ll come');
});

test('Android Spanish "p. m." / "a. m." markers, 2-digit year, 12AM edge', () => {
  const { msgs } = parse(F.androidEsPm);
  assert.deepEqual(msgs.map(m => m.t), [local(2026, 10, 5, 21, 15), local(2026, 10, 5, 23, 59), local(2026, 10, 6, 0, 5)]);
});

test('phone-number senders wrapped in U+202A…U+202C and "~ " collapse to ONE sender', () => {
  const { senders, msgs } = parse(F.iosPhoneSenders);
  assert.deepEqual(senders, ['+1 (555) 010-0000', 'Marta']);
  assert.equal(msgs[0].s, msgs[1].s);
});

test('poll: option lines stay inside one message', () => {
  const { msgs } = parse(F.iosPoll);
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].text, /Where shall we eat\?/);
  assert.match(msgs[0].text, /OPTION: Pizza place \(3 votes\)/);
});

test('iOS group notice "Marta created group" attributed to the group name is a system message', () => {
  const { msgs } = parse(F.iosGroupNotices);
  assert.equal(msgs[0].type, 'system');
});

test('typeOf: iOS sequence-prefixed attachment names', () => {
  assert.equal(core.typeOf('00000123-PHOTO-2026-03-01-10-05-00.jpg'), 'image');
  assert.equal(core.typeOf('00000043-VIDEO-2026-03-01-10-05-00.mp4'), 'video');
  assert.equal(core.typeOf('00000044-AUDIO-2026-03-01-10-05-00.opus'), 'audio');
  assert.equal(core.typeOf('Menu.pdf'), 'doc');
});

// ---- Gaps found by checking against the documented shapes (now fixed). Each has guard tests so the fix stays narrow.
const LRM = '\u200e';

test('iOS notices attributed to the group name do not create a participant', () => {
  const { msgs, senders } = parse(F.iosGroupNotices);
  assert.deepEqual(senders, ['Marta', 'Anna']);              // "Sunday Dinners" is not a person
  assert.deepEqual(msgs.map(m => m.type), ['system', 'system', 'text', 'text']);
  const { st } = full(F.iosGroupNotices);
  assert.equal(st.total, 2);                                  // and the notices are not counted as messages
  assert.equal(st.per.length, 2);
});

test('guard: a real person who also has an LRM-prefixed plain-text line keeps it and stays a sender', () => {
  const { msgs, senders } = parse(`[01/03/26, 10:00:00] Pau: ${LRM}some generated-looking text\n[01/03/26, 10:01:00] Pau: hi\n`);
  assert.deepEqual(senders, ['Pau']);
  assert.deepEqual(msgs.map(m => [m.type, m.s]), [['text', 0], ['text', 0]]);
});

test('guard: a sender who only ever sent photos/placeholders is still a participant', () => {
  const { senders, msgs } = parse(`[01/03/26, 10:00:00] Ravi: ${LRM}image omitted\n[01/03/26, 10:01:00] Ravi: ${LRM}<attached: 00000001-PHOTO-2026-03-01-10-01-00.jpg>\n[01/03/26, 10:02:00] Anna: nice\n`);
  assert.deepEqual(senders, ['Ravi', 'Anna']);
  assert.deepEqual(msgs.map(m => m.type), ['omitted', 'media', 'text']);
});

test('guard: a group-name sender is still caught when the notices come before anyone speaks, and after', () => {
  const t = `[05/10/26, 09:00:00] Crew: ${LRM}Marta added Anna\n[05/10/26, 09:01:00] Marta: hi\n[05/10/26, 09:02:00] Crew: ${LRM}Anna left\n`;
  const { senders, msgs } = parse(t);
  assert.deepEqual(senders, ['Marta']);
  assert.deepEqual(msgs.map(m => m.type), ['system', 'text', 'system']);
});

test('"Missed voice call" and video-call lines are system messages, but the caller stays a sender', () => {
  const { msgs, senders } = parse(F.iosCall);
  assert.deepEqual(senders, ['Anna']);                        // Pau only appears in the call line, so is not a person here
  assert.equal(msgs[1].type, 'system');
  const both = parse(F.iosCall + `[01/03/26, 10:03:00] Pau: back\n[01/03/26, 10:04:00] Pau: ${LRM}Video call, 3 min\n`);
  assert.deepEqual(both.senders, ['Anna', 'Pau']);            // Pau spoke, so is real; the call lines are still system
  assert.deepEqual(both.msgs.map(m => m.type), ['text', 'system', 'text', 'text', 'system']);
});

test('guard: typed text that merely mentions a call (no LRM) stays a message', () => {
  const { msgs } = parse(`[01/03/26, 10:00:00] Anna: Voice call?? where are you\n[01/03/26, 10:01:00] Anna: missed voice call from you earlier\n`);
  assert.deepEqual(msgs.map(m => m.type), ['text', 'text']);
});

test('Android notices whose quoted group name contains ": " are system messages, not a phantom sender', () => {
  assert.deepEqual(parse(F.androidSubjectColon).senders, ['Marta', 'Anna']);
  const t = `14/10/2026, 00:09 - Marta created group "Dinners: season 2"\n14/10/2026, 00:10 - Anna: hi\n`;
  const { senders, msgs } = parse(t);
  assert.deepEqual(senders, ['Anna']);
  assert.equal(msgs[0].type, 'system');
});

test('guard: a typed message that talks about a subject change after a normal "Name: " is not treated as a notice', () => {
  const { senders, msgs } = parse(`14/10/2026, 00:09 - Anna: Marta changed the subject from X to Y: lol\n`);
  assert.deepEqual(senders, ['Anna']);
  assert.equal(msgs[0].type, 'text');
});

// ---- SYS: WhatsApp's own notices. Anchored to the start of the body in their real shape AND only applied to
// ---- bodies that start with the iOS LRM mark (Android notices have no sender, so they never reach SYS).
const asSender = text => parse(`14/10/2026, 00:09 - Anna: ${text}\n`).msgs[0].type;           // typed: no LRM
// WhatsApp-generated: Anna also typed something, so the group-name logic (pend) cannot mask a SYS failure.
const asGen = text => parse(`14/10/2026, 00:08 - Anna: hello\n14/10/2026, 00:09 - Anna: ${LRM}${text}\n`).msgs[1].type;

const NOTICES = [
  'Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.',
  'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.',
  'Your security code with Marta changed. Tap to learn more.',
  'Marta\u2019s security code changed. Tap to learn more.',
  'Marta turned on disappearing messages. New messages will disappear from this chat after 7 days.',
  'You turned off disappearing messages.',
  'Disappearing messages were turned off.',
  'Marta updated the message timer. New messages will disappear from this chat after 24 hours.',
  'Marta created group \u201cSunday Dinners\u201d',
  'Marta created group "Sunday Dinners"',
  'You created group \u201cDinners: season 2\u201d',
  'Marta changed this group\u2019s icon',
  'Marta changed the group description',
  'You changed the group name from \u201cA\u201d to \u201cB\u201d',
  'Marta changed the subject from "A" to "B"',
  'Marta joined using this group\u2019s invite link',
  'Marta changed their phone number to a new number. Tap to message or add the new number.',
  'Marta is a contact.',
];

test('SYS: real notice wording from WhatsApp (LRM-prefixed) is a system message', () => {
  for (const n of NOTICES) assert.equal(asGen(n), 'system', n);
});

test('SYS: the same notice wording typed by a person (no LRM) is a normal message', () => {
  for (const n of NOTICES) assert.equal(asSender(n), 'text', n);
});

test('SYS: ordinary messages that merely contain those words are kept', () => {
  const typed = [
    'I created group chats for everyone',
    'created group chat for office',
    'we should use disappearing messages',
    'is it end-to-end encrypted though?',
    'Please use end-to-end encrypted chats for this',
    'my security code changed lol',
    'she changed the group chat photo again',
    'he is a contact for the plumber',
    'Marta changed the subject of the meeting',
  ];
  for (const m of typed) assert.equal(asSender(m), 'text', m);
});

test('SYS: sentences shaped exactly like a notice are kept when typed (the former residual)', () => {
  for (const m of ['I turned on disappearing messages', 'she is a contact', 'Marta created group "ours"', 'I changed this group\u2019s icon'])
    assert.equal(asSender(m), 'text', m);
});

test('SYS: a kept message still counts in the stats and keeps its sender', () => {
  const { C, st } = full('14/10/2026, 00:09 - Anna: I turned on disappearing messages\n14/10/2026, 00:10 - Marta: ok\n');
  assert.deepEqual(C.senders, ['Anna', 'Marta']);
  assert.equal(st.total, 2);
  assert.equal(st.per[0].msgs, 1);
});

test('SYS: genuine sender-less notices and iOS group-attributed notices are still system messages', () => {
  const android = parse('14/10/2026, 00:08 - Messages and calls are end-to-end encrypted. No one outside of this chat can read them.\n14/10/2026, 00:09 - Marta turned on disappearing messages. New messages will disappear from this chat after 7 days.\n');
  assert.deepEqual(android.msgs.map(m => m.type), ['system', 'system']);   // no sender: never reaches SYS
  const ios = parse(`[05/10/26, 09:30:02] Crew: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read them.\n[05/10/26, 09:31:00] Marta: hi\n`);
  assert.deepEqual(ios.msgs.map(m => m.type), ['system', 'text']);
  assert.deepEqual(ios.senders, ['Marta']);
});

test('SYS: an LRM-prefixed non-notice line from a real person is untouched', () => {
  const { msgs } = parse(`14/10/2026, 00:08 - Anna: hello\n14/10/2026, 00:09 - Anna: ${LRM}see you at the group meeting\n`);
  assert.deepEqual(msgs.map(m => m.type), ['text', 'text']);
});
