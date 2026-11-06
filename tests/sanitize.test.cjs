// Tests for tools/sanitize-export.mjs. All data here is invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./load-core.cjs');

const L = '‎', N = ' ';
// Everything in here is "sensitive": none of these tokens may appear in the output.
const SECRETS = ['priya', 'natarajan', 'karthik', 'iyer', 'rao', 'apollo', 'hospital', 'clinic', 'booking', 'secretid', 'trip', 'family',
  '482913', '9876543210', '98765', '43210', 'password', 'hunter2', 'kapoor', 'dosa', 'mumbai', 'cardnumber', 'invoice', 'salary', 'surprise'];

const IOS = [
  `${L}[25/12/2024, 09:00:00] ${L}Natarajan Family Trip: ${L}Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`,
  `[25/12/2024, 09:00:01] Natarajan Family Trip: ${L}Priya Natarajan created group “Natarajan Family Trip”`,
  `[25/12/2024, 09:00:02] Natarajan Family Trip: ${L}Priya Natarajan added Karthik Iyer and +91 98765 43210`,
  `${L}[25/12/2024, 09:05:09] Priya Natarajan: Hi Karthik, meeting Dr Rao at Apollo Hospital tomorrow 10:30! My OTP is 482913`,
  `[25/12/2024, 09:06:10] ~ Karthik Iyer: ok, call me on +91 98765 43210 or mail karthik.iyer@clinic-booking.example`,
  `second line has the password hunter2`,
  `[25/12/2024, 09:07:00] Priya Natarajan: https://www.youtube.com/watch?v=SECRETID123 and https://private-clinic.example/booking/ABC987?card=cardnumber`,
  `[25/12/2024, 09:08:00] Priya Natarajan: ${L}<attached: 00000012-PHOTO-2024-12-25-09-08-00.jpg>`,
  `[25/12/2024, 09:09:00] Karthik Iyer: ${L}image omitted`,
  `[25/12/2024, 09:10:00] Karthik Iyer: ${L}Mumbai-invoice-salary.pdf • ${L}3 pages ${L}document omitted`,
  `[25/12/2024, 09:11:00] Priya Natarajan: This message was deleted.`,
  `[25/12/2024, 09:12:00] Karthik Iyer: Missed it, sorry 😂 ${L}<This message was edited>`,
  `[25/12/2024, 09:13:00] Priya Natarajan: location: https://maps.google.com/?q=19.0760,72.8777`,
  `[25/12/2024, 09:14:00] Priya Natarajan: ${L}Mumbai-surprise-dosa.pdf • ${L}3 pages (file attached)`,
  `[25/12/2024, 09:15:00] Karthik Iyer: ${L}Missed voice call. ${L}Click to call back`,
  `[25/12/2024, 09:16:00] Priya Natarajan: ${L}POLL:`,
  `Where shall we eat dosa?`,
  `${L}OPTION: Surprise Kapoor place (3 votes)`,
  `[25/12/2024, 09:17:00] Natarajan Family Trip: ${L}Priya Natarajan did something we do not recognise for Priya Natarajan`,
].join('\n') + '\n';

const ANDROID = [
  `25/12/2024, 9:05 pm - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.`,
  `25/12/2024, 9:05 pm - Priya Natarajan created group "Natarajan Family: Trip"`,
  `25/12/2024, 9:06 pm - Priya Natarajan: Dr Rao at Apollo Hospital, OTP 482913`,
  `25/12/2024, 9:07 pm - Karthik Iyer: IMG-20241225-WA0001.jpg (file attached)`,
  `25/12/2024, 9:08 pm - Karthik Iyer: <Media omitted>`,
  `26/12/2024, 12:05 am - Karthik Iyer: kapoor@example.org said the surprise salary is 98765`,
].join('\n') + '\n';

const load = () => import('../tools/sanitize-export.mjs');
const words = t => t.toLowerCase().match(/\p{L}+/gu) ?? [];
const noSecrets = (out, label) => { const w = new Set(words(out)); for (const s of SECRETS) { if (/^\d+$/.test(s)) assert.ok(!out.includes(s), `${label}: ${s} leaked`); else assert.ok(!w.has(s) && !out.toLowerCase().includes(s.length > 5 ? s : '\u0000'), `${label}: "${s}" leaked`); } };

test('iOS: no secret survives, verification passes', async () => {
  const { sanitize } = await load();
  const r = sanitize(IOS, { seed: 't1' });
  assert.equal(r.check.ok, true, JSON.stringify(r.check.problems));
  noSecrets(r.text, 'ios');
});

test('Android: no secret survives, verification passes', async () => {
  const { sanitize } = await load();
  const r = sanitize(ANDROID, { seed: 't2' });
  assert.equal(r.check.ok, true, JSON.stringify(r.check.problems));
  noSecrets(r.text, 'android');
});

test('structure is preserved: same messages, types, sender count, hours, date order', async () => {
  const { sanitize } = await load();
  for (const src of [IOS, ANDROID]) {
    const r = sanitize(src, { seed: 's' });
    const A = core.parseChat(src, new Set()), B = core.parseChat(r.text, new Set());
    assert.equal(B.order, A.order);
    assert.equal(B.msgs.length, A.msgs.length);
    assert.deepEqual(B.msgs.map(m => m.type), A.msgs.map(m => m.type));
    assert.equal(B.senders.length, A.senders.length);
    assert.deepEqual(B.msgs.map(m => new Date(m.t).getHours() * 60 + new Date(m.t).getMinutes()), A.msgs.map(m => new Date(m.t).getHours() * 60 + new Date(m.t).getMinutes()));
    assert.deepEqual(B.msgs.map(m => m.s), A.msgs.map(m => m.s));
  }
});

test('senders become Person A/B…; the iOS group-name "sender" becomes Group and stays a non-participant', async () => {
  const { sanitize } = await load();
  const r = sanitize(IOS, { seed: 's' });
  const B = core.parseChat(r.text, new Set());
  assert.equal(B.senders.length, 2);
  assert.ok(B.senders.every(s => /^Person [A-Z]+$/.test(s)), B.senders.join());
  assert.ok(!B.senders.includes('Group'));
  assert.match(r.text, /Group: /);
});

test('dates are shifted by whole days with time of day and chronology kept; --keep-dates leaves them', async () => {
  const { sanitize } = await load();
  const A = core.parseChat(IOS, new Set());
  const r = sanitize(IOS, { seed: 's', shiftDays: -400 });
  const B = core.parseChat(r.text, new Set());
  B.msgs.forEach((m, i) => assert.equal(Math.round((A.msgs[i].t - m.t) / 864e5), 400));
  assert.ok(!r.text.includes('25/12/2024'));
  const k = sanitize(IOS, { seed: 's', keepDates: true });
  assert.match(k.text, /\[25\/12\/2024, 09:05:09\]/);
});

test('date shift keeps 2-digit years, separators and month-first order (US iOS)', async () => {
  const { sanitize } = await load();
  const us = `${L}[12/31/24, 11:59:30${N}PM] A: x\n${L}[1/1/25, 12:00:05${N}AM] B: y\n`;
  const r = sanitize(us, { seed: 's', shiftDays: -366 });
  const B = core.parseChat(r.text, new Set());
  assert.equal(B.order, 'mdy');
  assert.match(r.text, /^‎\[\d{1,2}\/\d{1,2}\/\d{2}, 11:59:30 PM\] /);
  assert.equal(B.msgs.length, 2);
});

test('byte-level details survive: BOM, CRLF, LRM marks, ~ prefix', async () => {
  const { sanitize } = await load();
  const src = '﻿' + IOS.replace(/\n/g, '\r\n');
  const r = sanitize(src, { seed: 's' });
  assert.ok(r.text.startsWith('﻿'));
  assert.ok(r.text.includes('\r\n') && !/[^\r]\n/.test(r.text));
  assert.match(r.text, /\] ~ Person [A-Z]+: /);
  assert.ok(r.text.includes(`${L}image omitted`));
});

test('placeholders and attachment shapes are kept in generic form', async () => {
  const { sanitize } = await load();
  const t = sanitize(IOS, { seed: 's' }).text;
  assert.match(t, /<attached: 00000001-PHOTO-2000-01-01-00-00-00\.jpg>/);
  assert.match(t, /Document\d+\.pdf • ‎3 pages ‎document omitted/);
  assert.match(t, /Document\d+\.pdf • ‎3 pages \(file attached\)/);
  assert.match(t, /This message was deleted\./);
  assert.match(t, /Missed voice call\. ‎Click to call back/);
  assert.match(t, /\n‎OPTION: [a-z ]+\(3 votes\)/i);
  assert.match(t, /<This message was edited>/);
  const a = sanitize(ANDROID, { seed: 's' }).text;
  assert.match(a, /IMG-20000101-WA0001\.jpg \(file attached\)/);
  assert.match(a, /<Media omitted>/);
});

test('links keep only a well-known host (or example.com); emails and numbers are neutralised', async () => {
  const { sanitize } = await load();
  const t = sanitize(IOS, { seed: 's' }).text;
  assert.match(t, /https:\/\/youtube\.com\/x/);
  assert.match(t, /https:\/\/example\.com\/x/);
  assert.match(t, /location: https:\/\/maps\.google\.com\/\?q=0,0/);
  assert.match(t, /user@example\.com/);
  const runs = t.replace(/^.*\] /gm, '').replace(/\d{8}-PHOTO-2000-01-01-00-00-00/g, '').match(/\d{4,}/g) ?? [];
  assert.ok(runs.every(r => !/[1-9]/.test(r)), runs.join());   // zeroed digits are fine; any other long number is a leak
  const nh = sanitize(IOS, { seed: 's', noHosts: true }).text;
  assert.ok(!nh.includes('youtube'));
});

test('notices: known shapes are kept with names replaced; unknown ones become a fixed placeholder', async () => {
  const { sanitize } = await load();
  const r = sanitize(IOS, { seed: 's' });
  assert.match(r.text, /created group “Group”/);
  assert.match(r.text, /Person [A-Z]+ added Person [A-Z]+, Person [A-Z]+/);
  assert.match(r.text, /<unrecognised notice replaced by sanitizer>/);
  assert.equal(r.stats.notices.replaced, 1);
  const a = sanitize(ANDROID, { seed: 's' }).text;
  assert.match(a, /created group "Group"/);          // a ": " inside the quoted name did not leak or split
});

test('the same seed is reproducible and a different seed gives different filler', async () => {
  const { sanitize } = await load();
  assert.equal(sanitize(IOS, { seed: 'a' }).text, sanitize(IOS, { seed: 'a' }).text);
  assert.notEqual(sanitize(IOS, { seed: 'a' }).text, sanitize(IOS, { seed: 'b' }).text);
});

test('output parses to the same stats shape (counts per type and sender)', async () => {
  const { sanitize } = await load();
  const r = sanitize(IOS, { seed: 's' });
  const strip = src => { const C = { files: new Map(), ...core.parseChat(src, new Set()) }; core.attachMedia(C); const st = core.computeStats(C); return { total: st.total, per: st.per.map(p => [p.msgs, p.media, p.links, p.q, p.del, p.edit]) }; };
  assert.deepEqual(strip(r.text), strip(IOS));
});

test('verifier: catches a leaked name, a long number, an email and an off-allowlist word', async () => {
  const { sanitize, verify } = await load();
  const good = sanitize(IOS, { seed: 's' });
  const people = new Map([['Priya Natarajan', 'Person A']]);
  assert.equal(verify(good.text, people).ok, true);
  const bad = verify(good.text + '\n[25/12/2024, 09:20:00] Person A: hello Priya, call 9876543210 or a@b.co and mention tomatoes\n', people);
  assert.equal(bad.ok, false);
  const msg = bad.problems.join(' | ');
  assert.match(msg, /original name/);
  assert.match(msg, /long number/);
  assert.match(msg, /email/);
  assert.match(msg, /allowlist/);
});

test('header detection agrees with the real parser on the repo fixtures', async () => {
  const { sanitize } = await load();
  const F = require('./fixtures.cjs');
  for (const [k, src] of Object.entries(F)) {
    const r = sanitize(src, { seed: 'f' });
    assert.equal(core.parseChat(r.text, new Set()).msgs.length, core.parseChat(src, new Set()).msgs.length, k);
    assert.equal(r.check.ok, true, `${k}: ${JSON.stringify(r.check.problems)}`);
  }
});

test('zip input: finds _chat.txt inside a stored zip', async () => {
  const { chatFromZip } = await load();
  const name = Buffer.from('_chat.txt'), data = Buffer.from('hello');
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(name.length, 28);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + name.length, 12); eocd.writeUInt32LE(30 + name.length + data.length, 16);
  const zip = Buffer.concat([lh, name, data, cd, name, eocd]);
  assert.equal(chatFromZip(zip), 'hello');
});

// ---- adversarial input: try to make it leak ----
const ADV = [
  `[05/10/26, 09:30:00] ${L}Σοφία Παπαδοπούλου: γεια σου Μαρία, το IBAN μου είναι GR1601101250000000012300695`,
  `[05/10/26, 09:31:00] D'Souza O'Brien: Priya's flight is BA2490 to Mumbai; ref XK29JQ7 – tell Dr. D'Souza`,
  `[05/10/26, 09:32:00] +91 98765 43210: मेरा नाम राहुल है और मेरा नंबर 9876543210 है`,
  `[05/10/26, 09:33:00] ~ ${L}\u202aHarshavardhan\u202c: "Harshavardhan said: see you at 5" 😀👨‍👩‍👧`,
  `[05/10/26, 09:34:00] Harshavardhan: ${L}Salary-Slip-Oct-Harshavardhan.xlsx • ${L}2 pages (file attached)`,
  `[05/10/26, 09:35:00] Harshavardhan: ${L}Passport_Scan_HV12345.heic (file attached)`,
  `[05/10/26, 09:36:00] Harshavardhan: ${L}<attached: Medical-Report-Harshavardhan.sqlite>`,
  `[05/10/26, 09:37:00] Σοφία Παπαδοπούλου: ${L}Harshavardhan was added by Σοφία Παπαδοπούλου`,
  `[05/10/26, 09:39:00] Harshavardhan: Bob@Work.Example mailed me; visit www.secret-site.example/path?token=abc123XYZ and bit.ly/3xYzAbC`,
  `[05/10/26, 09:40:00] Harshavardhan: ${L}`,
  `[05/10/26, 09:41:00] Harshavardhan: `,
  `[05/10/26, 09:42:00] Harshavardhan: mixed123abc456 and ABCDEF123456 and 12-34-56 and £1,234.50`,
  `[05/10/26, 09:43:00] Harshavardhan: @Σοφία @+91 98765 43210 ping`,
  `[05/10/26, 09:44:00] Harshavardhan: ${L}Harshavardhan changed this group\u2019s icon`,
  `continuation about Harshavardhan with his phone 98765-43210 and a verylongsupercalifragilisticexpialidocious word`,
].join('\n') + '\n';

test('adversarial: non-Latin names, phone senders, apostrophes, quoted names, odd attachments, glued IDs', async () => {
  const { sanitize } = await load();
  const r = sanitize(ADV, { seed: 'adv' });
  assert.equal(r.check.ok, true, JSON.stringify(r.check.problems));
  const low = r.text.toLowerCase();
  for (const s of ['harshavardhan', 'σοφία', 'παπαδοπούλου', 'μαρία', 'iban', 'gr160', "d'souza", "o'brien", 'priya', 'mumbai', 'xk29jq7', 'ba2490', 'राहुल',
    '98765', '43210', 'salary', 'passport', 'hv12345', 'medical', 'sqlite', 'secret-site', 'abc123xyz', 'bit.ly', '3xyzabc', 'work.example', 'bob', 'supercali'])
    assert.ok(!low.includes(s), `leaked: ${s}`);
  const B = core.parseChat(r.text, new Set());
  assert.equal(B.msgs.length, core.parseChat(ADV, new Set()).msgs.length);   // still the same number of messages
});

test('every word length up to 16 has allowlisted filler (so the verifier never false-alarms)', async () => {
  const { sanitize } = await load();
  for (let n = 1; n <= 40; n++) {
    const word = 'x'.repeat(n).replace(/x/g, 'q');
    const r = sanitize(`[01/02/2024, 10:00:00] A: ${word} ok\n`, { seed: 'len' });
    assert.equal(r.check.ok, true, `length ${n}: ${JSON.stringify(r.check.problems)}`);
  }
});

// ---- the command-line tool, end to end ----
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const CLI = path.join(__dirname, '..', 'tools', 'sanitize-export.mjs');

function storedZip(entries) {
  const parts = [], cds = []; let off = 0;
  for (const [name, text] of entries) {
    const nb = Buffer.from(name), data = Buffer.from(text);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(nb.length, 26); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nb.length, 28); cd.writeUInt32LE(off, 42);
    parts.push(lh, nb, data); cds.push(cd, nb); off += 30 + nb.length + data.length;
  }
  const cdBuf = Buffer.concat(cds), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cdBuf.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdBuf, e]);
}

test('CLI: a WhatsApp-style zip in, a sanitised file out, nothing sensitive printed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-'));
  const zip = path.join(dir, 'WhatsApp Chat with Priya Natarajan.zip');
  fs.writeFileSync(zip, storedZip([['IMG-20241225-WA0001.jpg', 'not text'], ['_chat.txt', '﻿' + IOS]]));
  const r = spawnSync('node', [CLI, zip, '--seed', 'cli'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = fs.readFileSync(path.join(dir, 'sanitized-chat.txt'), 'utf8');   // default output name, in the current directory
  noSecrets(out, 'cli output');
  const said = (r.stdout + r.stderr).toLowerCase();
  for (const s of ['priya', 'natarajan', 'karthik', 'apollo', '482913']) assert.ok(!said.includes(s), `the tool printed "${s}"`);
  assert.match(r.stderr, /read this|read every line/i);                          // reminds the user to review before committing
  assert.equal(core.parseChat(out, new Set()).msgs.length, core.parseChat(IOS, new Set()).msgs.length);
});

test('CLI: plain .txt input, explicit --out, reproducible with --seed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-'));
  const inp = path.join(dir, '_chat.txt'); fs.writeFileSync(inp, ANDROID);
  const run = o => { const r = spawnSync('node', [CLI, inp, '--out', path.join(dir, o), '--seed', 'same'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return fs.readFileSync(path.join(dir, o), 'utf8'); };
  assert.equal(run('a.txt'), run('b.txt'));
});

test('CLI: missing argument or file fails with a non-zero status and no output file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-'));
  assert.notEqual(spawnSync('node', [CLI], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.notEqual(spawnSync('node', [CLI, path.join(dir, 'nope.txt')], { cwd: dir, encoding: 'utf8' }).status, 0);
  assert.equal(fs.existsSync(path.join(dir, 'sanitized-chat.txt')), false);
});

test('CLI fail-safe: if verification fails, exit 1 and write NOTHING; --force writes anyway', () => {
  // A sender whose name tokens are filler words makes the "original name appears in output" check trip (the documented
  // "try another --seed" case), which is a legitimate way to exercise the failure path without any test hook.
  const names = 'Lorem Ipsum Dolor Vitae Justo Purus Magna Felis Risus Nulla Lacus Morbi';   // 5-letter words: every 5-letter filler word is one of these (and < 80 chars, so it parses as a sender)
  const text = `[01/02/2024, 10:00:00] ${names}: ` + Array.from({ length: 200 }, (_, i) => 'word' + 'abcdefghij'.slice(0, 1 + (i % 9))).join(' ') + '\n';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitize-'));
  const inp = path.join(dir, 'chat.txt'); fs.writeFileSync(inp, text);
  const r = spawnSync('node', [CLI, inp, '--out', path.join(dir, 'o.txt'), '--seed', 'x'], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /VERIFICATION FAILED/);
  assert.equal(fs.existsSync(path.join(dir, 'o.txt')), false);
  const f = spawnSync('node', [CLI, inp, '--out', path.join(dir, 'o.txt'), '--seed', 'x', '--force'], { encoding: 'utf8' });
  assert.equal(f.status, 0, f.stderr);
  assert.equal(fs.existsSync(path.join(dir, 'o.txt')), true);
});
