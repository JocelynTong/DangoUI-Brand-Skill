import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const origin = 'http://127.0.0.1:10092'
const roundUrl = (event = 0, round = 0) => `${origin}/#/pages/round/index?event=${event}&round=${round}`
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const isWrite = r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method())
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
})

const renders = []
for (const viewport of [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push(request))
  await page.goto(roundUrl(), { waitUntil: 'networkidle', timeout: 30000 })

  const visual = await page.evaluate(() => {
    const q = selector => document.querySelector(selector)
    const qa = selector => [...document.querySelectorAll(selector)]
    const visible = element => {
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
    }
    const rect = element => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
    }
    const measure = element => ({
      text: (element.textContent || '').trim(),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
    })
    const controls = qa('.round-page [role="button"]').filter(visible)
    const bodyText = document.body.innerText
    return {
      hierarchy: {
        masthead: rect(q('.softcard')),
        firstRow: rect(q('.rank-row')),
        firstMeaningfulRowWithinViewport: q('.rank-row').getBoundingClientRect().top < innerHeight,
        rows: qa('.rank-row').length,
      },
      semantics: {
        event: q('.event-name')?.textContent.trim(),
        round: q('.round-title')?.textContent.trim(),
        status: q('.stbadge')?.textContent.trim(),
        goldRank: q('.rank.gold')?.textContent.trim(),
        emptySlot: q('.empty-deck .muted-name')?.textContent.trim(),
        players: qa('.au').map(e => e.textContent.trim()),
        deckNames: qa('.dname').map(e => e.textContent.trim()),
        rankOrder: qa('.rank').map(e => e.textContent.trim()),
        hasScoreLabel: /积分|胜|负|分/.test(bodyText),
      },
      textFit: qa('.event-name,.round-title,.round-meta,.dname,.line-tag,.au,.stat,.empty-deck .muted-name').map(measure),
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      controls: controls.map(e => ({ text: (e.textContent || '').trim().slice(0, 60), rect: rect(e), tabindex: e.getAttribute('tabindex') })),
      undersizedControls: controls.filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44 }).length,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      activeMotion: controls.filter(e => {
        const style = getComputedStyle(e)
        return style.animationName !== 'none' || style.transitionDuration.split(',').some(value => parseFloat(value) > 0)
      }).map(e => (e.textContent || '').trim().slice(0, 40)),
      forbidden: {
        explicitHeroClasses: qa('.hero,[class*="hero"]').length,
        excessivePills: qa('.round-page *').filter(e => parseFloat(getComputedStyle(e).borderRadius) >= 999).length,
        blankViewportGap: q('.rank-row').getBoundingClientRect().top - q('.softcard').getBoundingClientRect().bottom,
      },
    }
  })

  const interactions = {}
  for (const input of ['pointer', 'Enter', 'Space']) {
    const interactionPage = await context.newPage()
    await interactionPage.goto(roundUrl(), { waitUntil: 'networkidle', timeout: 30000 })
    const control = interactionPage.locator('.deck-card[role="button"]').first()
    if (input === 'pointer') await control.click()
    else { await control.focus(); await interactionPage.keyboard.press(input) }
    await interactionPage.waitForTimeout(250)
    interactions[input] = /pages\/detail\/index/.test(interactionPage.url())
    await interactionPage.close()
  }

  const focusPage = await context.newPage()
  await focusPage.goto(roundUrl(), { waitUntil: 'networkidle', timeout: 30000 })
  const focusControl = focusPage.locator('.deck-card[role="button"]').first()
  await focusControl.focus()
  const focus = await focusControl.evaluate(e => {
    const style = getComputedStyle(e)
    return { retained: document.activeElement === e, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow }
  })
  await focusPage.close()

  const branches = []
  for (const [event, round, expected] of [[0, 0, '进行中'], [2, 0, '已结束'], [1, 0, '报名中']]) {
    const branchPage = await context.newPage()
    await branchPage.goto(roundUrl(event, round), { waitUntil: 'networkidle', timeout: 30000 })
    branches.push(await branchPage.evaluate(({ event, round, expected }) => ({
      query: { event, round }, expected,
      eventText: document.querySelector('.event-name')?.textContent.trim(),
      statusText: document.querySelector('.stbadge')?.textContent.trim(),
      roundText: document.querySelector('.round-title')?.textContent.trim(),
      rowCount: document.querySelectorAll('.rank-row').length,
      emptySlotText: document.querySelector('.empty-deck .muted-name')?.textContent.trim() || null,
      goldRankText: document.querySelector('.rank.gold')?.textContent.trim() || null,
      overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    }), { event, round, expected }))
    await branchPage.close()
  }

  const png = await page.screenshot({ path: path.join(out, `fresh-${viewport.width}x${viewport.height}-round.png`), fullPage: true })
  renders.push({ viewport, screenshotSha256: sha(png), visual, interactions, focus, branches, externalNetworkWrites: requests.filter(isWrite).map(r => ({ method: r.method(), url: r.url() })) })
  await context.close()
}

const regression = []
for (const route of ['plaza', 'build', 'detail', 'event', 'mine']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const requests = []
  page.on('request', request => requests.push(request))
  const suffix = route === 'detail' || route === 'event' ? '?id=0' : ''
  await page.goto(`${origin}/#/pages/${route}/index${suffix}`, { waitUntil: 'networkidle', timeout: 30000 })
  const png = await page.screenshot({ fullPage: true })
  regression.push({
    route,
    screenshotSha256: sha(png),
    overflowX: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)),
    externalNetworkWrites: requests.filter(isWrite).map(r => ({ method: r.method(), url: r.url() })),
  })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'fresh-browser-probes.json'), JSON.stringify({
  schema: 'heldout-round-fresh-independent-qa/v1',
  attempt: 20,
  generatedAt: new Date().toISOString(),
  qaRole: 'fresh-independent-visual-qa',
  readOnly: true,
  renders,
  regression,
}, null, 2) + '\n')
