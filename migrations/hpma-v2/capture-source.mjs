import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';

const root = process.cwd();
const out = path.join(root, 'output/extractor-benchmark/hpma-v2/source-captures');
fs.mkdirSync(out, { recursive: true });
const url = 'https://www.harrypottermagicawakened.com/cn/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(2500);

const pages = [
  { id: 'home', trigger: '.nav1', region: '.main', fallback: '.wrap' },
  { id: 'news', trigger: '.nav1', secondaryTrigger: '.news_btn', region: '.newsBig_box', fallback: '.newsBig' },
  { id: 'cards-media', trigger: '.nav4', region: '.media', fallback: '.mediabox' },
];
const manifest = { schema: 'hpma-source-capture/v1', sourceUrl: url, capturedAt: new Date().toISOString(), viewport: { width: 1280, height: 720 }, pages: [] };

for (const spec of pages) {
  await page.locator(spec.trigger).click();
  await page.waitForTimeout(1400);
  if (spec.secondaryTrigger) {
    await page.locator(spec.secondaryTrigger).click({ force: true });
    await page.waitForTimeout(900);
  }
  const dir = path.join(out, spec.id);
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
  const full = path.join(dir, 'full-page.png');
  await page.screenshot({ path: full, fullPage: true });
  const metrics = await page.evaluate(({ region, fallback }) => {
    const el = document.querySelector(region) || document.querySelector(fallback) || document.body;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      document: { scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth },
      region: { selector: el.matches(region) ? region : (el.matches(fallback) ? fallback : 'body'), boundingBox: { x: r.x, y: r.y, width: r.width, height: r.height }, visible: r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden', computed: { backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage, color: s.color, fontFamily: s.fontFamily, border: s.border, borderRadius: s.borderRadius } },
      activeNav: [...document.querySelectorAll('.nav_link')].map(e => ({ selector: '.' + [...e.classList].join('.'), className: e.className, text: e.textContent.trim(), color: getComputedStyle(e).color })).filter(x => /\bon\b/.test(x.className)),
    };
  }, spec);
  const maxScroll = Math.max(0, metrics.document.scrollHeight - 720);
  const positions = [...new Set([0, Math.floor(maxScroll / 2), maxScroll])];
  const frames = [];
  for (let i = 0; i < positions.length; i++) {
    await page.evaluate(y => window.scrollTo(0, y), positions[i]);
    await page.waitForTimeout(i === 0 ? 400 : 250);
    const actual = await page.evaluate(() => ({ scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight }));
    const frame = path.join(dir, 'frames', `${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: frame });
    frames.push({ index: i, timeMs: i * 500, label: i === 0 ? 'initial' : (i === positions.length - 1 ? 'settled-end' : 'continuous-scroll'), scrollTop: actual.scrollTop, scrollHeight: actual.scrollHeight, path: path.relative(root, frame) });
  }
  const timeline = path.join(dir, 'timeline.json');
  fs.writeFileSync(timeline, JSON.stringify({ meta: { sourceUrl: url, pageId: spec.id, viewport: { width: 1280, height: 720 }, scrollHeight: metrics.document.scrollHeight }, frames }, null, 2));
  manifest.pages.push({ id: spec.id, full, timeline, frameDir: path.join(dir, 'frames'), metrics });
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('.nav1').click();
await page.waitForTimeout(900);
await page.locator('.news_btn').click({ force: true });
await page.waitForTimeout(700);
const before = path.join(out, 'interaction-news-tab-before.png');
await page.screenshot({ path: before });
const beforeState = await page.locator('.nav_tit3').evaluate(e => ({ className: e.className, color: getComputedStyle(e).color, backgroundColor: getComputedStyle(e).backgroundColor }));
await page.locator('.nav_tit3').click({ force: true });
await page.waitForTimeout(100);
const transition = path.join(out, 'interaction-news-tab-transition.png');
await page.screenshot({ path: transition });
await page.waitForTimeout(800);
const after = path.join(out, 'interaction-news-tab-after.png');
await page.screenshot({ path: after });
const afterState = await page.locator('.nav_tit3').evaluate(e => ({ className: e.className, color: getComputedStyle(e).color, backgroundColor: getComputedStyle(e).backgroundColor }));
await page.locator('.nav_tit1').click({ force: true });
await page.waitForTimeout(800);
const restored = path.join(out, 'interaction-news-tab-restored.png');
await page.screenshot({ path: restored });
manifest.interaction = { id: 'news-category-trigger', selector: '.nav_tit3', trigger: 'click', before, transition, after, restored, beforeState, afterState };

fs.writeFileSync(path.join(out, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
console.log(JSON.stringify({ ok: true, out, pages: manifest.pages.map(p => ({ id: p.id, metrics: p.metrics })), interaction: manifest.interaction }, null, 2));
