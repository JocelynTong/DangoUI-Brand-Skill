import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/event/index?id=0'
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const renders = []
for (const viewport of [{width:390,height:844},{width:536,height:864},{width:1280,height:720}]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const probe = await page.evaluate(() => {
    const q = selector => document.querySelector(selector)
    const rect = element => { const r = element.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, width:r.width, height:r.height } }
    const title = q('.event-title'), status = q('.stbadge'), head = q('.event-head'), section = q('.sectitle'), round = q('.roundcard'), topDeck = q('.topdeck'), more = q('.more')
    return {
      title: { text:title.textContent.trim(), rect:rect(title), clipped:getComputedStyle(title).overflow === 'hidden' && (title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight) },
      status: { text:status.textContent.trim(), rect:rect(status) },
      head: rect(head), section: rect(section), firstRound: rect(round), topDeck: rect(topDeck), more: rect(more),
      fold: { section:rect(section).top < innerHeight, firstRound:rect(round).top < innerHeight, topDeck:rect(topDeck).top < innerHeight },
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      motion: { root:getComputedStyle(q('.event-page')).animationName, round:getComputedStyle(round).transitionDuration },
      colors: { page:getComputedStyle(q('.event-page')).backgroundColor, head:getComputedStyle(head).backgroundColor, round:getComputedStyle(round).backgroundColor }
    }
  })
  const screenshot = `selfcheck-${viewport.width}x${viewport.height}-event.png`
  await page.screenshot({ path:path.join(out, screenshot), fullPage:true })
  renders.push({ viewport, screenshot, probe, writes:requests.filter(request => !['GET','HEAD','OPTIONS'].includes(request.method)) })
  await context.close()
}

const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
const page = await context.newPage()
const interactions = []
for (const [key,press] of [['Enter','Enter'],['Space',' ']]) {
  await page.goto(base, { waitUntil:'networkidle' })
  const action = page.locator('.more').first()
  await action.focus()
  const before = page.url()
  await action.press(press)
  await page.waitForTimeout(150)
  interactions.push({ target:'round', key, changed:page.url() !== before, after:page.url() })
}
for (const [key,press] of [['Enter','Enter'],['Space',' ']]) {
  await page.goto(base, { waitUntil:'networkidle' })
  const action = page.locator('.topdeck').first()
  await action.focus()
  const before = page.url()
  await action.press(press)
  await page.waitForTimeout(150)
  interactions.push({ target:'topDeck', key, changed:page.url() !== before || await page.locator('.doverlay').count() > 0, overlay:await page.locator('.doverlay').count() > 0, after:page.url() })
}
await context.close()

const otherRoutes = []
for (const route of ['plaza','build','mine','round','detail']) {
  const suffix = route === 'round' ? '?event=0&round=1' : route === 'detail' ? '?id=0' : ''
  const context = await browser.newContext({ viewport:{width:390,height:844}, reducedMotion:'reduce' })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`, { waitUntil:'networkidle', timeout:30000 })
  const png = await page.screenshot({ fullPage:true })
  otherRoutes.push({ route, sha256:crypto.createHash('sha256').update(png).digest('hex'), overflow:await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)) })
  await context.close()
}
await browser.close()
await fs.writeFile(path.join(out, 'browser-probes.json'), JSON.stringify({ schema:'heldout-event-minimal-experiment-selfcheck/v1', attempt:11, generatedAt:new Date().toISOString(), readOnly:true, renders, interactions, otherRoutes }, null, 2) + '\n')
