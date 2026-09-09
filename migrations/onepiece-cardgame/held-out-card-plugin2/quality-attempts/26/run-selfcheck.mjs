import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const host = 'http://127.0.0.1:10092/#/pages/plaza/index'
const injected = '这是仅用于隔离浏览器测试的确定性超长卡组标题样本'
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const results = []

for (const viewport of [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  await page.goto(host, { waitUntil: 'networkidle' })
  const setup = await page.evaluate(async title => {
    const cards = await import('/data/cards.js')
    const router = await import('/@fs/Users/jocelyn/Downloads/vibecoding-docs-demo/card-plugin2.0/frontend/node_modules/.vite/deps/@tarojs_router.js')
    const originalTitle = cards.decks[0].t
    const originalHistory = router.history
    cards.decks[0].t = title
    const proxy = new Proxy(originalHistory, { get(target, key) { if (key === 'push') return () => { throw new Error('QA_NAVIGATION_REJECTION') }; const value = target[key]; return typeof value === 'function' ? value.bind(target) : value } })
    router.setHistory(proxy)
    window.__attempt26 = { cards, router, originalTitle, originalHistory }
    return { originalTitle, injectedTitle: cards.decks[0].t, routerInstalled: router.history === proxy }
  }, injected)

  await page.locator('.deck-card').first().click()
  await page.locator('.doverlay.shown').waitFor({ timeout: 5000 })
  const restoreRouter = await page.evaluate(() => { const q = window.__attempt26; q.router.setHistory(q.originalHistory); return q.router.history === q.originalHistory })

  const exerciseToggle = async locator => {
    const values = []
    for (const mode of ['pointer', 'Enter', 'Space']) {
      let error = null
      try { if (mode === 'pointer') await locator.click({ timeout: 1200 }); else await locator.press(mode) } catch (reason) { error = String(reason.message || reason).split('\n')[0] }
      values.push({ mode, expanded: await locator.getAttribute('aria-expanded'), error })
    }
    if (await locator.getAttribute('aria-expanded') === 'true') await locator.press('Enter')
    return { values, restored: await locator.getAttribute('aria-expanded') }
  }
  const titleToggle = page.locator('.doverlay .title-toggle-inline')
  const descToggle = page.locator('.doverlay .desc-toggle-inline')
  const disclosures = {
    titleCount: await titleToggle.count(),
    descCount: await descToggle.count(),
    title: await exerciseToggle(titleToggle),
    description: await exerciseToggle(descToggle)
  }

  const fav = page.locator('.doverlay .dbtn-fav')
  const favorite = []
  for (const mode of ['pointer', 'Enter', 'Space']) {
    if (mode === 'pointer') await fav.click(); else await fav.press(mode)
    favorite.push(await fav.innerText())
  }
  await fav.click()
  const buy = page.locator('.doverlay .buybtn')
  for (const mode of ['pointer', 'Enter', 'Space']) { if (mode === 'pointer') await buy.click(); else await buy.press(mode) }
  const buyToast = await page.locator('body').evaluate(element => element.innerText.includes('去购买 ｜ 跳转卡组 SPU'))

  await page.locator('.doverlay .tb').nth(1).press('Enter')
  await page.locator('.doverlay .txt-row').first().press('Space')
  await page.locator('.cv.on').waitFor()
  await page.locator('.cv').click({ position: { x: 3, y: 3 } })
  await page.locator('.doverlay .tb').first().press('Space')
  await page.locator('.doverlay .gcard').first().press('Enter')
  await page.locator('.cv.on').waitFor()
  await page.locator('.cv').click({ position: { x: 3, y: 3 } })

  const probe = await page.evaluate(() => {
    const rect = element => { const value = element.getBoundingClientRect(); return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height } }
    const bottom = document.querySelector('.doverlay > .dbottom')
    const controls = [...bottom.querySelectorAll('[role="button"]')]
    const titleToggle = document.querySelector('.doverlay .title-toggle-inline')
    const titleRect = rect(titleToggle)
    const titleHit = document.elementFromPoint(titleRect.left + titleRect.width / 2, titleRect.top + titleRect.height / 2)
    const tagsRect = rect(document.querySelector('.doverlay .dtags'))
    const descToggle = document.querySelector('.doverlay .desc-toggle-inline')
    const descRect = rect(descToggle)
    const descHit = document.elementFromPoint(descRect.left + descRect.width / 2, descRect.top + descRect.height / 2)
    const buy = document.querySelector('.doverlay .buybtn')
    const buyRect = rect(buy)
    const buyHit = document.elementFromPoint(buyRect.left + buyRect.width / 2, buyRect.top + buyRect.height / 2)
    const statRect = rect(document.querySelector('.doverlay .statcard'))
    return {
      bottom: rect(bottom),
      titleToggle: { rect: titleRect, centerOwner: titleHit?.className || '', scrollWidth: titleToggle.scrollWidth, clientWidth: titleToggle.clientWidth, overlapsTags: titleRect.bottom > tagsRect.top },
      descToggle: { rect: descRect, centerOwner: descHit?.className || '', scrollWidth: descToggle.scrollWidth, clientWidth: descToggle.clientWidth },
      buy: { rect: buyRect, centerOwner: buyHit?.className || '', scrollWidth: buy.scrollWidth, clientWidth: buy.clientWidth, insideStat: buyRect.left >= statRect.left && buyRect.right <= statRect.right && buyRect.top >= statRect.top && buyRect.bottom <= statRect.bottom },
      controls: controls.map(element => ({ className: element.className, rect: rect(element), borderRadius: getComputedStyle(element).borderRadius, background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color })),
      undersized: controls.filter(element => rect(element).width < 44 || rect(element).height < 44).map(element => element.className),
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      reducedMotion: [...document.querySelectorAll('.doverlay,.doverlay *')].filter(element => { const style = getComputedStyle(element); return (style.animationName !== 'none' && style.animationDuration !== '0s') || style.transitionDuration !== '0s' }).length
    }
  })
  await page.screenshot({ path: path.join(out, `overlay-${viewport.width}x${viewport.height}.png`), fullPage: false })

  const restored = await page.evaluate(() => {
    const q = window.__attempt26
    q.cards.decks[0].t = q.originalTitle
    const value = q.cards.decks[0].t
    delete window.__attempt26
    return value
  })
  results.push({ viewport, setup: { ...setup, originalHash: hash(setup.originalTitle), injectedHash: hash(setup.injectedTitle) }, restoreRouter, disclosures, favorite, buyToast, probe, restored: { value: restored, hash: hash(restored), exact: restored === setup.originalTitle }, writes: requests.filter(request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'selfcheck-probes.json'), JSON.stringify({ schema: 'heldout-detail-overlay-attempt26-selfcheck/v1', attempt: 26, testOnly: true, productionSourceChanged: false, injected, results }, null, 2) + '\n')
