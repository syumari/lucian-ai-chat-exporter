// Run with esbuild --bundle --platform=node --packages=external; all web responses are synthetic.
import puppeteer, { type Target, type Page } from 'puppeteer-core';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { route, PAGES } from '../tests/e2e/mock-sites';
import { CHATGPT_ID } from '../tests/fixtures/sites';
import { conv, msg } from '../tests/fixtures/handoff-scenarios';
import { toChatGPTPayload } from '../tests/fixtures/synthetic';
import type { JobState } from '../src/shared/types';

const out = resolve('test-output/japanese');
const profile = mkdtempSync(join(tmpdir(), 'lucian-ja-'));
const downloads = join(out, 'downloads');
mkdirSync(join(profile, 'Default'), { recursive: true });
mkdirSync(downloads, { recursive: true });
writeFileSync(join(profile, 'Default', 'Preferences'), JSON.stringify({
  intl: { accept_languages: 'ja-JP,ja' },
  download: { default_directory: downloads, prompt_for_download: false, directory_upgrade: true },
}));
const dist = resolve('dist');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true, userDataDir: profile,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--lang=ja-JP', '--no-first-run', '--no-default-browser-check'],
});
const errors: string[] = [];
const japanese = conv([
  msg('user', '日本語の会話を保存したい。既存のファイルを削除しないでください。'),
  msg('assistant', '保存機能の実装が完了しました。\n\n```ts\nconsole.log("日本語のテスト");\n```'),
  msg('user', 'Markdownを採用することにした。次に書き出し機能を追加してください。'),
  msg('assistant', '書き出し機能は未実装です。次の作業は表示確認です。'),
], '日本語の会話テスト');
const payload = { ...toChatGPTPayload(japanese), conversation_id: CHATGPT_ID };
async function attach(target: Target) {
  if (!['page', 'service_worker'].includes(target.type())) return;
  const session = await target.createCDPSession();
  session.on('Fetch.requestPaused', async ev => {
    const headers = Object.fromEntries(Object.entries(ev.request.headers).map(([k, v]) => [k.toLowerCase(), v]));
    let res = route({ url: ev.request.url, method: ev.request.method, headers, postData: ev.request.postData });
    if (res && ev.request.url === PAGES.chatgpt && typeof res.body === 'string') res = { ...res, body: res.body.replaceAll('Null 오류 분석', '日本語の会話テスト') };
    if (ev.request.url.startsWith(`https://chatgpt.com/backend-api/conversation/${CHATGPT_ID}`)) res = { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
    try {
      if (!res) { await session.send('Fetch.failRequest', { requestId: ev.requestId, errorReason: 'BlockedByClient' }); return; }
      await session.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: res.status, responseHeaders: Object.entries(res.headers ?? {}).map(([name, value]) => ({ name, value })), body: Buffer.from(res.body).toString('base64') });
    } catch { /* A tab can close during an intercepted request. */ }
  });
  await session.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
}
const report: Record<string, unknown> = {};
let popup: Page;
try {
  browser.on('targetcreated', t => { void attach(t).catch(e => errors.push(String(e))); });
  const sw = await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  await attach(sw);
  const extId = new URL(sw.url()).host;
  const site = await browser.newPage();
  await site.goto(PAGES.chatgpt);
  await new Promise(r => setTimeout(r, 500));
  popup = await browser.newPage();
  popup.on('pageerror', e => errors.push(String(e)));
  await popup.setViewport({ width: 360, height: 900, deviceScaleFactor: 1.5 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  const tabId = await popup.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url)?.id, PAGES.chatgpt);
  assert(tabId);
  await popup.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
  await popup.waitForSelector('#handoffBtn:not([disabled])');
  report.browserLanguage = await popup.evaluate(() => chrome.i18n.getUILanguage());
  assert.equal(await popup.$eval('html', el => el.lang), 'ja');
  assert.equal(await popup.$eval('#hHandoff', el => el.textContent), '別のAIに引き継ぐ');
  await popup.click('#moreBtn');
  await popup.screenshot({ path: join(out, 'popup-ja.png'), fullPage: true });
  const clipped = await popup.$$eval('.fmt-label, #handoffBtn span, #moreLabel', els => els.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
  assert.deepEqual(clipped, [], 'Japanese button labels must not be clipped');
  report.clippedLabels = clipped;
  async function run(selector: string) {
    const started = Date.now();
    await popup.click(selector);
    await popup.waitForFunction(async (id, since) => {
      const j = (await chrome.storage.session.get(`job:${id}`))[`job:${id}`] as JobState | undefined;
      return !!j && j.startedAt >= since - 50 && ['done', 'error', 'print'].includes(j.phase) && (j.phase !== 'print' || j.result);
    }, { timeout: 60000, polling: 100 }, tabId!, started);
    const job = await popup.evaluate(async id => (await chrome.storage.session.get(`job:${id}`))[`job:${id}`] as JobState, tabId!);
    assert.notEqual(job.phase, 'error', JSON.stringify(job));
    return job;
  }
  for (const format of ['md', 'txt', 'docx', 'hwpx', 'html', 'json', 'zip']) {
    const job = await run(`.fmt[data-format="${format}"]`);
    assert.equal(job.phase, 'done');
    report[format] = { phase: job.phase, bytes: job.result?.bytes };
    console.log(`${format}: saved`);
  }
  const handoff = await run('#handoffBtn');
  assert.equal(handoff.phase, 'done');
  const handoffFile = readdirSync(downloads).find(f => f.includes('handoff') && f.endsWith('.md'));
  assert(handoffFile);
  const handoffText = readFileSync(join(downloads, handoffFile), 'utf8');
  assert(handoffText.includes('AI作業引き継ぎ'));
  assert(handoffText.includes('日本語'));
  report.handoff = handoff.phase;
  await popup.screenshot({ path: join(out, 'handoff-ja.png'), fullPage: true });
  await popup.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await popup.screenshot({ path: join(out, 'popup-ja-dark.png'), fullPage: true });
  const printed = await run('.fmt[data-format="pdf"]');
  assert.equal(printed.phase, 'print');
  const printTarget = await browser.waitForTarget(t => t.url().includes('/print.html'));
  const printPage = await printTarget.page();
  assert(printPage);
  await printPage.waitForSelector('#doc .msg');
  assert((await printPage.$eval('body', el => el.textContent))?.includes('PDFに保存'));
  await printPage.pdf({ path: join(out, 'japanese-export.pdf'), format: 'A4', printBackground: true });
  await printPage.screenshot({ path: join(out, 'print-ja.png'), fullPage: true });
  report.pdf = 'print page rendered and PDF saved';
  report.errors = errors;
  assert.deepEqual(errors, []);
  report.downloads = readdirSync(downloads);
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
