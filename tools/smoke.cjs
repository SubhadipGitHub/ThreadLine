#!/usr/bin/env node
/* Headless smoke test for Threadline (needs `playwright` + a Chromium).
 *   node tools/smoke.cjs            run all checks
 *   SHOTS=/some/dir node tools/smoke.cjs   also save screenshots
 * Exits non-zero on any failure or console/page error.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const SHOTS = process.env.SHOTS;
const tmp = mkdtempSync(path.join(tmpdir(), 'threadline-'));
const dm = path.join(tmp, 'dm.txt');
execFileSync('node', [path.join(__dirname, 'make-sample-chat.mjs'), dm]);
const junk = path.join(tmp, 'junk.txt');
writeFileSync(junk, 'hello this is not a whatsapp chat\njust some lines\n');
const pic = path.join(tmp, 'pic.png');
writeFileSync(pic, Buffer.from('89504e470d0a1a0a', 'hex'));

let fails = 0;
const ok = (c, m) => { if (c) console.log('  ok  ' + m); else { fails++; console.log('  FAIL ' + m); } };
const shot = async (p, n, full) => { if (SHOTS) { await p.waitForTimeout(500); await p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: !!full }); } };

(async () => {
  const browser = await chromium.launch();
  const fresh = async (vp = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.errs = [];
    p.on('pageerror', e => p.errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
    await p.goto(URL);
    return p;
  };
  const noErrors = (p, label) => ok(p.errs.length === 0, `${label}: no console/page errors${p.errs.length ? ' → ' + p.errs.join(' | ') : ''}`);

  console.log('Home page');
  let p = await fresh();
  ok(await p.locator('#btnDemo').isVisible(), 'demo button visible');
  ok(await p.locator('.steps .step').count() === 3, 'three how-it-works steps');
  await p.click('#ptI'); ok(await p.locator('#expI').isVisible() && !(await p.locator('#expA').isVisible()), 'iPhone export steps switch in');
  await p.click('#homeGuide'); ok(await p.locator('.modal.wide #gBody').isVisible(), 'guide opens from home');
  await p.click('.gnav [data-g=trouble]'); ok((await p.textContent('#gBody')).includes('Not exported'), 'guide sections switch');
  await p.keyboard.press('Escape'); ok(!(await p.locator('.ov').count()), 'Esc closes guide');
  await shot(p, 'home', true); noErrors(p, 'home');

  console.log('Demo + tour');
  await p.click('#btnDemo');
  await p.waitForSelector('#tourPop', { timeout: 20000 });
  ok(await p.locator('body.demo').count() === 1 && await p.locator('#demoBar').isVisible(), 'demo banner shown');
  ok((await p.textContent('#tourPop')).includes('Welcome'), 'tour auto-starts on first chat');
  let steps = 0;
  while (await p.locator('#tourPop [data-t=next]').count()) {
    const label = (await p.textContent('#tourPop [data-t=next]')).trim();
    if (steps === 3) await shot(p, 'tour-step');
    await p.click('#tourPop [data-t=next]'); steps++;
    if (label === 'Done') break;
    await p.waitForTimeout(60);
  }
  ok(steps === 10 && !(await p.locator('#tourPop').count()), `tour runs ${steps} steps and closes`);
  ok(await p.evaluate(() => localStorage.getItem('threadline.tour.v1')) === '1', 'tour completion remembered');
  ok(await p.locator('#v-overview .hint').count() === 1, 'overview tip shown');
  await p.click('#v-overview .hint .hx'); ok(await p.locator('#v-overview .hint').count() === 0, 'tip dismissed');
  for (const t of ['overview', 'timeline', 'calendar', 'media', 'links', 'chat', 'wrapped']) {
    await p.click(`[data-tab=${t}]`); await p.waitForTimeout(150);
    ok(await p.locator(`#v-${t}`).isVisible() && (await p.locator(`#v-${t}`).innerHTML()).length > 200, `${t} view renders`);
    if (t === 'media') ok(await p.locator('#v-media .callout').count() === 1, 'media view explains missing files');
  }
  await p.click('[data-tab=overview]'); await shot(p, 'overview');
  noErrors(p, 'demo');

  console.log('Menu: change “You”');
  const youBefore = await p.textContent('.vs-head .who b');
  await p.click('#btnMenu'); ok(await p.locator('#menu').isVisible(), 'menu opens'); await shot(p, 'menu');
  await p.click('#menu [data-a=me]'); await p.waitForSelector('.modal .opt');
  await p.keyboard.press('Escape');
  ok(!(await p.locator('.ov').count()) && (await p.textContent('.vs-head .who b')) === youBefore, 'Esc on the picker leaves “You” unchanged');
  await p.click('#btnMenu'); await p.click('#menu [data-a=me]'); await p.waitForSelector('.modal .opt');
  await p.click('.modal .opt >> nth=1'); await p.waitForTimeout(300);
  ok(/Mira/.test(await p.textContent('.vs-head .who small')) || (await p.textContent('.vs-head .who b')) === 'You', 'picking the other person re-renders');
  await p.click('#btnMenu'); await p.click('#menu [data-a=tour]'); await p.waitForSelector('#tourPop');
  await p.keyboard.press('Escape'); ok(!(await p.locator('#tourPop').count()), 'tour replays from menu and Esc closes it');
  await p.click('#btnHelp'); await shot(p, 'guide'); await p.keyboard.press('?'); // ? while modal open must not stack
  ok(await p.locator('.ov').count() === 1, 'guide opens once');
  await p.keyboard.press('Escape');
  await p.click('#btnMenu'); await p.click('#menu [data-a=forget]'); await p.waitForSelector('#home:not([hidden])');
  ok(await p.locator('body.demo').count() === 0, 'exiting demo returns home');
  noErrors(p, 'menu');
  await p.context().close();

  console.log('Real file flow + errors');
  p = await fresh();
  await p.evaluate(() => localStorage.setItem('threadline.tour.v1', '1'));
  await p.setInputFiles('#fileIn', dm);
  await p.waitForSelector('.modal .opt');
  await p.keyboard.press('Escape');                       // regression: used to hang forever
  await p.waitForSelector('#appv:not([hidden])', { timeout: 15000 });
  ok(true, 'Esc on “Which one is you?” no longer hangs the load');
  await p.waitForFunction(() => /Saved in this browser/.test(document.querySelector('#toast')?.textContent || ''));
  await p.click('#btnMenu'); await p.click('#menu [data-a=home]'); await p.waitForSelector('#home:not([hidden])');
  await p.waitForSelector('#saved .sv', { timeout: 5000 }).catch(() => {});
  ok(await p.locator('#saved .sv').count() === 1, 'chat saved and listed on home');
  await p.setInputFiles('#fileIn', junk); await p.waitForSelector('.problem');
  ok((await p.textContent('.problem')).includes('doesn’t look like a WhatsApp export'), 'junk .txt → friendly error'); await shot(p, 'problem');
  await p.click('.modal [data-ok]');
  await p.setInputFiles('#fileIn', pic); await p.waitForSelector('.problem');
  ok((await p.textContent('.problem')).includes('couldn’t find a chat'), 'no .txt → friendly error');
  await p.click('.modal [data-g]'); ok((await p.textContent('#gBody')).includes('Troubleshooting'), 'error links to troubleshooting guide');
  noErrors(p, 'files');
  await p.context().close();

  console.log('Mobile (390×844)');
  p = await fresh({ width: 390, height: 844 });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'home has no horizontal overflow');
  await shot(p, 'mobile-home');
  await p.click('#btnDemo'); await p.waitForSelector('#tourPop', { timeout: 20000 });
  for (let i = 0; i < 9; i++) {
    await p.click('#tourPop [data-t=next]'); await p.waitForTimeout(80);
    const r = await p.evaluate(() => { const b = document.querySelector('#tourPop').getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
    if (!(r[0] >= 0 && r[1] >= 0 && r[2] <= 390 && r[3] <= 844)) { ok(false, `tour popover on-screen at step ${i + 2} ${r}`); break; }
    if (i === 3) await shot(p, 'mobile-tour');
  }
  ok(await p.locator('#tourPop').count() === 1, 'mobile tour popovers stay on screen');
  await p.click('#tourPop [data-t=next]');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'app has no horizontal overflow on mobile');
  await shot(p, 'mobile-overview');
  noErrors(p, 'mobile');

  await browser.close();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
