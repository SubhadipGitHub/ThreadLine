#!/usr/bin/env node
/* Anonymise a WhatsApp export so it can be used as a test fixture.  DEV TOOL: runs locally, makes no network calls.
 *
 *   node tools/sanitize-export.mjs "WhatsApp Chat with X.zip"            -> ./sanitized-chat.txt
 *   node tools/sanitize-export.mjs _chat.txt --out /tmp/anon.txt [--seed s] [--shift-days N | --keep-dates] [--no-hosts]
 *
 * Design: ALLOWLIST, fail-safe.  The header (date, time, bracket style, invisible marks) is kept so parser tests stay
 * real; everything else is rebuilt from a closed vocabulary:
 *   senders        -> "Person A", "Person B", ...   (group name used as a "sender" by iOS -> "Group")
 *   message text   -> same-shape filler words (length, case, punctuation, emoji, line breaks kept)
 *   digits         -> 0           links -> https://<well-known host or example.com>/x     emails -> user@example.com
 *   attachments    -> generic names that keep the type pattern     notices -> templates with names replaced
 *   anything unrecognised in a notice -> a fixed placeholder line
 * A verification pass then checks that every word in the output comes from the allowlist and that no original name,
 * phone number or long number survived. If it fails, NOTHING is written (override with --force at your own risk).
 * It cannot judge your content: READ the output before committing it. See docs/SANITIZING.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ---- reuse the app's own header/notice constants so the sanitizer can never drift from the parser ---- */
function loadParser() {
  const html = readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
  const a = html.indexOf('function CORE(){'), b = html.indexOf('\nconst CORE_API=CORE();');
  if (a < 0 || b < 0) throw new Error('Could not find CORE() in index.html');
  const core = html.slice(a, b);
  const c0 = core.indexOf("const SP='"), c1 = core.indexOf('const plausible=');
  if (c0 < 0 || c1 < 0) throw new Error('Could not find the header/notice constants in CORE()');
  const consts = core.slice(c0, core.indexOf('\n', c1));
  return new Function(core + '\nconst P=CORE();\n' + consts + '\nreturn {parseChat:P.parseChat,RE_AND,RE_IOS,OMIT,ATT_WORDS,NOTICE,plausible};')();
}

/* ---- filler vocabulary (Latin, so it cannot collide with real names or words by accident) ---- */
const LOREM = `a e o u ut ad ex in et at ab ac id ne si ob dui sed vel nam est hac nec eos qui tum sem cum
amet elit quis nisi ipsa urna enim orci odio quam arcu nunc lorem ipsum dolor vitae justo purus magna felis risus
nulla lacus morbi tellus mattis tortor libero varius congue mauris cursus rutrum tempor semper ornare gravida
aliquam euismod feugiat pretium ultrices aliquet viverra sodales laoreet interdum vehicula facilisi tincidunt
fermentum eleifend ullamcorper imperdiet consequat vestibulum condimentum suspendisse sollicitudin pellentesque
adipiscing malesuada porttitor dignissim ridiculus scelerisque dictumst`.split(/\s+/);
const BUCKET = new Map();
for (const w of LOREM) (BUCKET.get(w.length) ?? BUCKET.set(w.length, []).get(w.length)).push(w);
// lengths 13-16 have no natural word: use fixed two-word compounds so every length up to 16 has allowlisted filler
for (let n = 13; n <= 16; n++) {
  const out = [];
  for (const a of LOREM) for (const b of LOREM) if (a.length >= 4 && b.length >= 4 && a.length + b.length === n && out.length < 8) out.push(a + b);
  BUCKET.set(n, out);
}
const FILLER_SET = new Set([...BUCKET.values()].flat());

/* every word the tool itself can emit besides filler (used by the verifier) */
const STRUCT_WORDS = new Set(`person group you messages and calls are end to encrypted no one outside of this chat not even whatsapp can read or
listen them only people in share your security code with changed tap learn more s created added removed left joined using
invite link icon description subject from name turned on off disappearing new will disappear after hours hour days day
weeks week updated the message timer their phone number a message add is contact were unrecognised notice replaced by sanitizer
image video audio sticker gif document card omitted media deleted this was edited attached file voice call missed declined
unanswered click back poll option votes vote pages page min mins minute minutes sec secs second seconds location view once photo voice example com https
http www x user q maps photo ptt stk img vid wa doc aud jpg jpeg png webp heic bmp mp4 mov mkv webm avi m opus ogg oga m a mp pdf
docx xlsx pptx txt vcf zip csv json bin ptt`.split(/\s+/));
const PUBLIC_HOSTS = new Set(`youtube.com youtu.be instagram.com maps.app.goo.gl maps.google.com google.com open.spotify.com spotify.link
twitter.com x.com t.co linkedin.com reddit.com amazon.in amazon.com flipkart.com myntra.com github.com docs.google.com drive.google.com
zomato.com swiggy.com booking.com airbnb.com tripadvisor.com wa.me`.split(/\s+/));
const KNOWN_EXT = new Set(`jpg jpeg png gif webp heic heif bmp mp4 mov 3gp mkv webm avi m4v opus ogg oga m4a mp3 aac wav amr pdf docx doc xlsx xls pptx ppt txt vcf zip csv json`.split(/\s+/));

const LRM = '‎';
const INVIS = '‎‏‪-‮';
const Q = '["\\u201c\\u201d]';
const sha = s => createHash('sha256').update(s).digest('hex');
const label = n => { let s = ''; n++; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };

export function sanitize(input, opts = {}) {
  const P = loadParser();
  const seed = opts.seed ?? randomBytes(8).toString('hex');
  const salt = sha('threadline-sanitize|' + seed);
  const noHosts = !!opts.noHosts;

  const bom = input.startsWith('﻿') ? '﻿' : '';
  const body0 = bom ? input.slice(1) : input;
  const eol = body0.includes('\r\n') ? '\r\n' : '\n';
  const text = body0.replace(/\r\n?/g, '\n');
  const { order } = P.parseChat(text, new Set());
  const lines = text.split('\n');

  /* date shifting: whole days, time of day untouched, chronology and format preserved */
  const rnd = parseInt(sha(salt + 'shift').slice(0, 6), 16);
  const shift = opts.keepDates ? 0 : (opts.shiftDays ?? -(180 + (rnd % 720)));

  const stats = { lines: lines.length, headers: 0, senders: 0, notices: { kept: 0, templated: 0, replaced: 0 }, urls: 0, emails: 0, attachments: 0, shift };
  const people = new Map();                 // original name -> label
  const nm = raw => {
    const core = String(raw).replace(new RegExp(`[${INVIS}~]`, 'g'), '').trim();
    if (/^you$/i.test(core)) return 'You';
    if (!people.has(core)) people.set(core, 'Person ' + label(people.size));
    return people.get(core);
  };
  const names = list => list.split(/,\s*|\s+and\s+/).map(nm).join(', ');

  /* ---- pass 1: header detection + which "senders" are really the group (iOS attributes notices to the group name) ---- */
  const isPlaceholder = t => P.OMIT.test(t.trim()) || /^(This message was deleted|You deleted this message)\.?$/.test(t.trim()) ||
    /<attached:/.test(t) || (/^(.+\.[A-Za-z0-9]{2,5})(?:\s•.*?)?\s\(([^()]{3,40})\)$/.exec(t.split('\n')[0]) && true) ||
    /\bdocument omitted$/i.test(t.replace(/‎/g, '').trim()) || /\b(?:voice|video) call\b|click to call back/i.test(t);
  const split = rest => {
    const ci = rest.indexOf(': ');
    if (ci > 0 && ci < 80 && !P.NOTICE.test(rest)) return { sender: rest.slice(0, ci), body: rest.slice(ci + 2) };
    return { sender: null, body: rest };
  };
  const hdr = lines.map(ln => {
    const m = new RegExp(P.RE_AND.source, 'd').exec(ln) || new RegExp(P.RE_IOS.source, 'd').exec(ln);
    if (!m || !P.plausible(m)) return null;
    const [rs] = m.indices[8];
    return { m, prefix: ln.slice(0, rs), ...split(ln.slice(rs)) };
  });
  const sstat = new Map();
  for (const h of hdr) {
    if (!h || h.sender == null) continue;
    const k = h.sender.replace(new RegExp(`[${INVIS}~]`, 'g'), '').trim();
    const s = sstat.get(k) ?? sstat.set(k, { total: 0, gen: 0 }).get(k);
    s.total++;
    if (h.body.charCodeAt(0) === 0x200e && !isPlaceholder(h.body.replace(/^[‎‏]+/, ''))) s.gen++;
  }
  const groupSenders = new Set([...sstat].filter(([, s]) => s.total > 0 && s.total === s.gen).map(([k]) => k));

  /* ---- filler / token rewriting ---- */
  const fillerFor = word => {
    const cps = [...word], n = cps.length, lower = word.toLowerCase();
    let f;
    const pick = k => { const b = BUCKET.get(k); return b && b[parseInt(sha(salt + lower).slice(0, 8), 16) % b.length]; };
    if (n <= 16 && pick(n)) f = pick(n);
    else { const parts = []; for (let rem = n; rem > 0; rem -= 9) parts.push(pick(Math.min(8, rem)) ?? 'lorem'); f = parts.join('-'); }   // very long runs: allowlisted pieces joined by hyphens
    if (n > 1 && word === word.toUpperCase() && word !== word.toLowerCase()) return f.toUpperCase();
    if (cps[0] !== cps[0].toLowerCase()) return f[0].toUpperCase() + f.slice(1);
    return f;
  };
  const urlFor = raw => {
    stats.urls++;
    let host = 'example.com', p = '/x';
    try {
      const u = new URL(raw.replace(/[).,!?;:'"\]]+$/, ''));
      const h = u.hostname.replace(/^www\./, '');
      if (!noHosts && PUBLIC_HOSTS.has(h)) host = h;
      if (host === 'google.com' && u.pathname.startsWith('/maps')) p = '/maps/x';
      if (host === 'maps.google.com') p = '/?q=0,0';
    } catch { /* fall through to example.com */ }
    return `https://${host}${p}`;
  };
  const UNIT = /^\s?(?:pages?|votes?|mins?|minutes?|secs?|seconds?|hours?)\b/i;
  const TOK = /(https?:\/\/[^\s<>"]+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(\p{L}[\p{L}\p{M}'’]*)|(\d+)/gu;
  const UNIT_WORD = /^(?:pages?|votes?|mins?|minutes?|secs?|seconds?|hours?)$/i;
  const filterText = t => t.replace(TOK, (m, url, email, word, num, off, str) => {
    if (url) return urlFor(url);
    if (email) { stats.emails++; return 'user@example.com'; }
    if (word) return UNIT_WORD.test(word) && /\d\s?$/.test(str.slice(Math.max(0, off - 3), off)) ? word : fillerFor(word);
    return UNIT.test(str.slice(off + m.length)) ? m : '0'.repeat(m.length);
  });
  let attachN = 0;
  const anonAttach = name => {
    stats.attachments++; attachN++;
    const n8 = String(attachN).padStart(8, '0'), n4 = String(attachN).padStart(4, '0');
    const em = /\.([A-Za-z0-9]{2,5})$/.exec(name), ext = em && KNOWN_EXT.has(em[1].toLowerCase()) ? em[1].toLowerCase() : 'bin';
    const stem = name.replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(new RegExp(`[${INVIS}]`, 'g'), '').trim();
    let m;
    if ((m = /^\d{8}-(PHOTO|VIDEO|AUDIO|GIF|STICKER|DOCUMENT)-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.exec(stem))) return `${n8}-${m[1]}-2000-01-01-00-00-00.${ext}`;
    if ((m = /^(IMG|VID|PTT|AUD|STK|DOC)-\d{8}-WA\d{4}$/.exec(stem))) return `${m[1]}-20000101-WA${n4}.${ext}`;
    return `Document${attachN}.${ext}`;
  };

  /* ---- notices: only these shapes are kept (with names replaced); anything else becomes a fixed placeholder ---- */
  const TAIL = '(?: New messages will disappear from this chat after (\\d+) (hours?|days?|weeks?)\\.)?';
  const NOTICES = [
    [/^Messages and calls are end-to-end encrypted\. (?:No one outside of this chat, not even WhatsApp, can read or listen to them|Only people in this chat can read, listen to, or share them)\.$/, m => m[0]],
    [/^Disappearing messages were turned off\.$/, m => m[0]],
    [/^Your security code with (.+) changed\.(?: Tap to learn more\.)?$/, m => `Your security code with ${nm(m[1])} changed. Tap to learn more.`],
    [/^(.+?)[’']s security code changed\.(?: Tap to learn more\.)?$/, m => `${nm(m[1])}’s security code changed. Tap to learn more.`],
    [new RegExp(`^(.+?) created group (${Q}).*(${Q})$`), m => `${nm(m[1])} created group ${m[2]}Group${m[3]}`],
    [new RegExp(`^(.+?) changed the subject from (${Q}).*(${Q}) to (${Q}).*(${Q})$`), m => `${nm(m[1])} changed the subject from ${m[2]}Group${m[3]} to ${m[4]}Group${m[5]}`],
    [new RegExp(`^(.+?) changed the subject to (${Q}).*(${Q})$`), m => `${nm(m[1])} changed the subject to ${m[2]}Group${m[3]}`],
    [new RegExp(`^(.+?) changed the group name from (${Q}).*(${Q}) to (${Q}).*(${Q})$`), m => `${nm(m[1])} changed the group name from ${m[2]}Group${m[3]} to ${m[4]}Group${m[5]}`],
    [/^(.+?) (added|removed) (.{1,120})$/, m => `${nm(m[1])} ${m[2]} ${names(m[3])}`],
    [/^(.+?) left$/, m => `${nm(m[1])} left`],
    [/^(.+?) joined using this group[’']s invite link$/, m => `${nm(m[1])} joined using this group’s invite link`],
    [/^(.+?) changed this group[’']s icon$/, m => `${nm(m[1])} changed this group’s icon`],
    [/^(.+?) changed the group description$/, m => `${nm(m[1])} changed the group description`],
    [new RegExp(`^(.+?) turned (on|off) disappearing messages\\.${TAIL}$`), m => `${nm(m[1])} turned ${m[2]} disappearing messages.` + (m[3] ? ` New messages will disappear from this chat after ${m[3]} ${m[4]}.` : '')],
    [/^(.+?) updated the message timer\. New messages will disappear from this chat after (\d+) (hours?|days?|weeks?)\.$/, m => `${nm(m[1])} updated the message timer. New messages will disappear from this chat after ${m[2]} ${m[3]}.`],
    [/^(.+?) changed their phone number to a new number\. Tap to message or add the new number\.$/, m => `${nm(m[1])} changed their phone number to a new number. Tap to message or add the new number.`],
    [/^(.+?) is a contact\.$/, m => `${nm(m[1])} is a contact.`],
  ];
  const REPLACED = '<unrecognised notice replaced by sanitizer>';
  const notice = t => {
    for (const [re, f] of NOTICES) { const m = re.exec(t); if (m) { stats.notices[re === NOTICES[0][0] || re === NOTICES[1][0] ? 'kept' : 'templated']++; return f(m); } }
    stats.notices.replaced++; return REPLACED;
  };

  /* ---- one message body (first line of a message, or a continuation line) ---- */
  const body = (b, { first, group, hasSender }) => {
    const lead = b.match(/^[‎‏]*/)[0];
    let t = b.slice(lead.length), tail = '';
    const em = /(\s*‎?<This message was edited>)$/.exec(t);
    if (em) { tail = em[1]; t = t.slice(0, -tail.length); }
    const tt = t.trim();
    if (first) {
      if (P.OMIT.test(tt) || /^(This message was deleted|You deleted this message)\.?$/.test(tt)) return lead + t + tail;
      let m;
      if ((m = /^(.*?)<attached:\s*([^>]+)>(.*)$/.exec(t))) return lead + filterText(m[1]) + `<attached: ${anonAttach(m[2].trim())}>` + filterText(m[3]) + tail;
      if ((m = /^(.+\.[A-Za-z0-9]{2,5})(?:\s•(.*?))?\s\(([^()]{3,40})\)$/.exec(t)) && P.ATT_WORDS.test(m[3])) {
        const pages = m[2] && /^[‎\s]*(\d{1,4}) pages?[‎\s]*$/.exec(m[2]);
        return lead + anonAttach(m[1].replace(new RegExp(`[${INVIS}]`, 'g'), '').trim()) + (pages ? ` • ${LRM}${pages[1]} pages` : '') + ` (${m[3]})` + tail;
      }
      if ((m = /^(.+?)\s•\s(.*?)‎?\s*document omitted$/i.exec(t.replace(/‎/g, '')))) {
        const pg = /(\d{1,4}) pages?/.exec(m[2]);
        return lead + `${anonAttach(m[1])} • ${LRM}${pg ? pg[1] : 1} pages ${LRM}document omitted` + tail;
      }
      if (lead && /^(?:Missed |Declined |Unanswered )?(?:voice|video) call\.?(?: ?‎?Click to call back)?$/i.test(tt)) return lead + t + tail;
      if (/^location:\s*https?:/i.test(t)) return lead + 'location: ' + urlFor(t.replace(/^location:\s*/i, '').split(/\s/)[0]) + tail;
      if (!hasSender || group) return lead + notice(tt) + tail;
    }
    const pre = /^(POLL|OPTION):/.exec(t);
    return lead + (pre ? pre[0] + filterText(t.slice(pre[0].length)) : filterText(t)) + tail;
  };

  /* ---- date rewrite: same separators and field widths, shifted by whole days ---- */
  const redate = (prefix, m) => {
    if (!shift) return prefix;
    const [a, b, c] = [m[1], m[2], m[3]];
    let y, mo, d;
    if (order === 'ymd') { y = +a; mo = +b; d = +c; } else if (order === 'mdy') { mo = +a; d = +b; y = +c; } else { d = +a; mo = +b; y = +c; }
    const shortYear = order !== 'ymd' && c.length <= 2;
    if (shortYear) y += 2000;
    const t = new Date(Date.UTC(y, mo - 1, d) + shift * 864e5);
    const ny = t.getUTCFullYear(), nmo = t.getUTCMonth() + 1, nd = t.getUTCDate();
    const two = (v, orig) => orig.length >= 2 ? String(v).padStart(2, '0') : String(v);      // keep "5" vs "05"
    const yr = orig => shortYear ? String(ny % 100).padStart(orig.length, '0') : String(ny).padStart(orig.length, '0');
    let na, nb, nc;
    if (order === 'ymd') { na = yr(a); nb = two(nmo, b); nc = two(nd, c); }
    else if (order === 'mdy') { na = two(nmo, a); nb = two(nd, b); nc = yr(c); }
    else { na = two(nd, a); nb = two(nmo, b); nc = yr(c); }
    const [s1, e1] = m.indices[1], [s2, e2] = m.indices[2], [s3, e3] = m.indices[3];
    return prefix.slice(0, s1) + na + prefix.slice(e1, s2) + nb + prefix.slice(e2, s3) + nc + prefix.slice(e3);
  };

  /* ---- pass 2: rebuild ---- */
  const out = [];
  lines.forEach((ln, i) => {
    const h = hdr[i];
    if (!h) { out.push(body(ln, { first: false, hasSender: true })); return; }
    stats.headers++;
    const prefix = redate(h.prefix, h.m);
    if (h.sender == null) { out.push(prefix + body(h.body, { first: true, hasSender: false })); return; }
    const mm = /^([~\s‎‏‪-‮]*)(.*?)([‎‏‪-‮\s]*)$/s.exec(h.sender);
    const key = mm[2].trim();
    const isGroup = groupSenders.has(h.sender.replace(new RegExp(`[${INVIS}~]`, 'g'), '').trim());
    const who = isGroup ? 'Group' : nm(key);
    out.push(prefix + mm[1] + who + mm[3] + ': ' + body(h.body, { first: true, group: isGroup, hasSender: true }));
  });
  stats.senders = people.size;

  const result = bom + out.join(eol);
  return { text: result, stats, seed, check: verify(result, people, eol) };
}

/* ---- independent verification of the OUTPUT (does not trust the rewriting code above) ---- */
export function verify(output, people, eol = '\n') {
  const P = loadParser();
  const problems = [];
  const nameTokens = new Set();
  for (const n of people.keys()) for (const t of n.toLowerCase().split(/[^\p{L}\p{M}]+/u)) if (t.length >= 3) nameTokens.add(t);
  const lines = output.replace(/^﻿/, '').split(/\r?\n/);
  const SAFE_WORDS = w => FILLER_SET.has(w) || STRUCT_WORDS.has(w);
  const bad = new Map();
  lines.forEach((ln, i) => {
    const m = new RegExp(P.RE_AND.source, 'd').exec(ln) || new RegExp(P.RE_IOS.source, 'd').exec(ln);
    let rest = ln;
    if (m && P.plausible(m)) rest = ln.slice(m.indices[8][0]);
    // closed-vocabulary labels and the generated placeholder
    rest = rest.replace(/Person [A-Z]{1,3}\b/g, ' ').replace(/\bGroup\b/g, ' ').replace(/\bYou\b/g, ' ');
    rest = rest.replace(/https:\/\/[a-z0-9.-]+(?:\/[^\s]*)?/g, ' ').replace(/user@example\.com/g, ' ');
    for (const w of rest.match(/\p{L}[\p{L}\p{M}'’]*/gu) ?? []) {
      const lw = w.toLowerCase().replace(/['’]s$/, '');
      if (nameTokens.has(lw)) problems.push(`line ${i + 1}: an original name appears in the output`);
      else if (!SAFE_WORDS(lw) && !/^[a-z]$/.test(lw)) bad.set(lw, (bad.get(lw) ?? 0) + 1);
    }
    const digits = rest.replace(/\d{8}-(?:PHOTO|VIDEO|AUDIO|GIF|STICKER|DOCUMENT)-|WA\d{4}|20000101|2000-01-01/g, '').match(/\d{4,}/g) ?? [];
    if (digits.some(r => /[1-9]/.test(r))) problems.push(`line ${i + 1}: a long number survived`);
    if (/@[\w-]+\.[\w.]+/.test(rest.replace(/user@example\.com/g, ''))) problems.push(`line ${i + 1}: an email-like token survived`);
  });
  if (bad.size) problems.push(`words outside the allowlist: ${[...bad.keys()].slice(0, 12).join(', ')}${bad.size > 12 ? ', …' : ''}`);
  return { ok: problems.length === 0, problems: [...new Set(problems)].slice(0, 20) };
}

/* ---- minimal zip reader (stored/deflate, no zip64): returns the chat text file ---- */
export function chatFromZip(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557 - 22); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Not a valid zip (no end-of-directory record).');
  const cnt = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  if (p === 0xffffffff) throw new Error('zip64 archives are not supported; unzip it and pass the .txt file.');
  const ents = [];
  for (let k = 0; k < cnt && buf.readUInt32LE(p) === 0x02014b50; k++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    ents.push({ name: buf.toString('utf8', p + 46, p + 46 + nl), method, csize, usize, lho });
    p += 46 + nl + xl + cl;
  }
  const txt = ents.filter(x => /\.txt$/i.test(x.name) && !/^__MACOSX/.test(x.name));
  const pick = txt.find(x => /(^|\/)_chat\.txt$/i.test(x.name)) ?? txt.sort((a, b) => b.usize - a.usize)[0];
  if (!pick) throw new Error('No .txt chat file found inside the zip.');
  const ds = pick.lho + 30 + buf.readUInt16LE(pick.lho + 26) + buf.readUInt16LE(pick.lho + 28);
  const raw = buf.subarray(ds, ds + pick.csize);
  return (pick.method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
}

/* ---- CLI ---- */
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = n => args.includes(n);
  const val = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const input = args.find((a, i) => !a.startsWith('--') && !['--out', '--seed', '--shift-days'].includes(args[i - 1]));
  if (!input || flag('--help')) {
    console.error('usage: node tools/sanitize-export.mjs <chat.txt|export.zip> [--out FILE] [--seed S] [--shift-days N | --keep-dates] [--no-hosts] [--force]');
    process.exit(input ? 0 : 2);
  }
  const out = val('--out') ?? 'sanitized-chat.txt';
  const buf = readFileSync(input);
  const text = buf.readUInt32LE(0) === 0x04034b50 ? chatFromZip(buf) : buf.toString('utf8');
  const r = sanitize(text, { seed: val('--seed'), keepDates: flag('--keep-dates'), noHosts: flag('--no-hosts'), shiftDays: val('--shift-days') != null ? +val('--shift-days') : undefined });
  const s = r.stats;
  console.error(`read ${s.lines} lines, ${s.headers} messages; ${s.senders} people -> "Person A…"; notices kept/templated/replaced: ${s.notices.kept}/${s.notices.templated}/${s.notices.replaced}; links ${s.urls}, emails ${s.emails}, attachments ${s.attachments}; dates shifted ${s.shift} days`);
  if (!r.check.ok) {
    console.error('\nVERIFICATION FAILED, so the output was ' + (flag('--force') ? 'written anyway (--force)' : 'NOT written') + ':');
    for (const p of r.check.problems) console.error('  - ' + p);
    console.error('Try another --seed, or fix the input by hand. Do not commit unreviewed output.');
    if (!flag('--force')) process.exit(1);
  }
  writeFileSync(out, r.text);
  console.error(`\nwrote ${out} (seed ${r.seed})\nNEXT: open it and read every line. The tool cannot judge your content. Commit only if nothing identifying remains. See docs/SANITIZING.md.`);
}
