const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const captures = path.join(root, 'captures');
fs.mkdirSync(captures, { recursive: true });
const url = 'http://127.0.0.1:5177/#/brand/onepiece-cardgame/pages/onepiece-cardgame-home';
const executablePath = '/Users/jocelyn/.agent-browser/browsers/chrome-152.0.7977.42/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(captures, 'demo-mobile-full-390x844.png'), fullPage: true });
  const base = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const actions = [...document.querySelectorAll('a,button,[role="button"],input,select,textarea')].map((el, i) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { i, tag: el.tagName, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0,80), x:r.x,y:r.y,width:r.width,height:r.height,display:cs.display,visibility:cs.visibility };
    }).filter(x => x.width > 0 && x.height > 0);
    const candidates = all.filter(el => {
      const c = (el.className || '').toString().toLowerCase();
      const id = (el.id || '').toLowerCase();
      return /preview|canvas|phone|shell|hero|welcome|news|arrival|product|event|schedule|recommend|video|footer|wave/.test(c+' '+id);
    }).map(el => { const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return {tag:el.tagName,id:el.id,cls:(el.className||'').toString().slice(0,160),x:r.x,y:r.y,width:r.width,height:r.height,overflowX:cs.overflowX,overflowY:cs.overflowY,fontSize:cs.fontSize}; }).filter(x=>x.width>0&&x.height>0);
    return {viewport:{width:innerWidth,height:innerHeight},document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},actions,candidates,bodyText:document.body.innerText.slice(0,5000)};
  });
  const maxY = Math.max(0, base.document.scrollHeight - 844);
  const stops = [...new Set([0,700,1400,2100,2800,3500,4200,maxY].map(y=>Math.min(y,maxY)))];
  for (let i=0;i<stops.length;i++) {
    await page.evaluate(y => scrollTo(0,y), stops[i]);
    await page.waitForTimeout(100);
    await page.screenshot({ path:path.join(captures,`demo-mobile-section-${i+1}-y${stops[i]}.png`) });
  }
  await page.evaluate(() => scrollTo(0,0));
  await page.locator('body').screenshot({ path:path.join(captures,'demo-mobile-top.png') });
  await page.evaluate(() => scrollTo(0,6150));
  await page.screenshot({ path:path.join(captures,'demo-mobile-footer-motion-0ms.png') });
  await page.waitForTimeout(300);
  await page.screenshot({ path:path.join(captures,'demo-mobile-footer-motion-300ms.png') });
  await page.waitForTimeout(500);
  await page.screenshot({ path:path.join(captures,'demo-mobile-footer-motion-800ms.png') });

  const desktop = await browser.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1, reducedMotion:'no-preference' });
  const dpage = await desktop.newPage();
  await dpage.goto(url,{waitUntil:'networkidle'});
  await dpage.screenshot({path:path.join(captures,'demo-desktop-phone-shell.png')});
  await dpage.evaluate(() => { const el=document.querySelector('.phone-screen'); if(el) el.scrollTop=el.scrollHeight; });
  await dpage.waitForTimeout(100);
  await dpage.screenshot({path:path.join(captures,'demo-desktop-phone-shell-footer-0ms.png')});
  await dpage.waitForTimeout(700);
  await dpage.screenshot({path:path.join(captures,'demo-desktop-phone-shell-footer-700ms.png')});
  const desktopProbe = await dpage.evaluate(() => {
    const all=[...document.querySelectorAll('*')];
    const nodes=all.filter(el=>/phone|shell|preview|canvas|footer|wave/.test(((el.className||'')+' '+(el.id||'')).toLowerCase())).map(el=>{const r=el.getBoundingClientRect();const c=getComputedStyle(el);return{tag:el.tagName,id:el.id,cls:(el.className||'').toString().slice(0,160),x:r.x,y:r.y,width:r.width,height:r.height,overflowX:c.overflowX,overflowY:c.overflowY,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}}).filter(x=>x.width>0&&x.height>0);
    return {viewport:{width:innerWidth,height:innerHeight},document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},nodes};
  });
  fs.writeFileSync(path.join(root,'probes.json'), JSON.stringify({url,mobile:base,scrollStops:stops,desktop:desktopProbe},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
