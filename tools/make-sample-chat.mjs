#!/usr/bin/env node
// Generates a synthetic WhatsApp export (Android 12h style) for testing.
// Usage: node tools/make-sample-chat.mjs [out.txt] [--group]
import { writeFileSync } from 'node:fs';
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'sample-chat.txt';
const group = process.argv.includes('--group');
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = a => a[Math.floor(rnd() * a.length)];
const people = group ? ['Asha', 'Rahul', 'Meera', 'Dev'] : ['Asha', 'Rahul'];
const lines = ['01/03/2024, 9:00 am - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.'];
const texts = ['good morning 😊', 'lunch today?', 'haha that was so funny 😂😂', 'sending the link https://youtu.be/dQw4w9WgXcQ', 'can you call me later?', 'running late, sorry', 'check this https://maps.app.goo.gl/abc123', 'did you see the match last night?', 'ok done', 'what time are we meeting?', 'happy birthday!! 🎉', 'miss you ❤️', 'movie tonight?', '<Media omitted>', 'IMG-20240305-WA0001.jpg (file attached)'];
const d = new Date(2024, 2, 1);
for (let day = 0; day < 240; day++) {
  d.setDate(d.getDate() + 1);
  if (rnd() < 0.2) continue;
  const n = 3 + Math.floor(rnd() * 25); let h = 8 + Math.floor(rnd() * 3), m = 0;
  for (let i = 0; i < n; i++) {
    m += Math.floor(rnd() * 12); if (m >= 60) { h = Math.min(23, h + 1); m -= 60; }
    const hh = h % 12 || 12, ap = h < 12 ? 'am' : 'pm';
    lines.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}, ${hh}:${String(m).padStart(2, '0')} ${ap} - ${pick(people)}: ${pick(texts)}`);
  }
}
writeFileSync(out, lines.join('\n') + '\n');
console.log(`wrote ${out} (${lines.length} lines, ${people.length} people)`);
