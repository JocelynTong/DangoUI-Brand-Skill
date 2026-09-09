import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/build/index'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] })
const renders = []

const probePage = async page => page.evaluate(() => {
  const all = selector => [...document.querySelectorAll(selector)]
  const rect = element => {
    if (!element) return null
    const r = element.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }
  }
  const visible = element => {
    const s = getComputedStyle(element)
    const r = element.getBoundingClientRect()
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0
  }
  const interactives = all('[role="button"],[role="tab"],input,textarea').filter(visible)
  return {
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    header: rect(document.querySelector('.dkhead')),
    search: rect(document.querySelector('.b-search')),
    filterRows: all('.filter-row').filter(visible).map(rect),
    pool: rect(document.querySelector('.poollist,.poolgrid')),
    firstCard: rect(document.querySelector('.lrow,.pgcard')),
    tray: rect(document.querySelector('.tray')),
    cardCount: all('.lrow,.pgcard').filter(visible).length,
    poolMode: document.querySelector('.poolgrid') ? 'grid' : 'list',
    interactiveCount: interactives.length,
    under44: interactives.map(element => ({
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') || element.innerText || element.getAttribute('placeholder') || '',
      rect: rect(element),
    })).filter(item => item.rect.width < 44 || item.rect.height < 44).slice(0, 30),
    pillControls: interactives.filter(element => {
      const r = element.getBoundingClientRect()
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0
      return r.height >= 30 && radius >= r.height / 2 - 1
    }).length,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
})

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const externalWrites = []
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      externalWrites.push({ method: request.method(), url: request.url() })
      await route.abort()
      return
    }
    await route.continue()
  })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })
  const initial = await probePage(page)
  await page.screenshot({ path: path.join(out, `fresh-${viewport.width}x${viewport.height}-build-default.png`) })

  const more = page.locator('.filter-more')
  await more.press('Enter')
  const expandedEnter = await probePage(page)
  await more.press('Space')
  const collapsedSpace = await probePage(page)

  const view = page.locator('.viewtoggle')
  const viewBefore = await view.getAttribute('aria-pressed')
  await view.press('Enter')
  const gridEnter = await probePage(page)
  const viewAfterEnter = await view.getAttribute('aria-pressed')
  await view.press('Space')
  const listSpace = await probePage(page)
  const viewAfterSpace = await view.getAttribute('aria-pressed')

  const firstType = page.getByRole('button', { name: '宝可梦', exact: true }).first()
  const cardsBeforeFilter = initial.cardCount
  await firstType.press('Enter')
  const filteredEnter = await probePage(page)
  await page.getByRole('button', { name: '全部', exact: true }).first().press('Space')
  const resetSpace = await probePage(page)

  const search = page.locator('.b-search-in input')
  await search.fill('超梦')
  const searched = await probePage(page)
  const searchedFirstResult = await page.locator('.lrow-name,.pg-name').first().textContent().catch(() => '')
  await search.fill('')

  const plus = page.getByRole('button', { name: '添加卡牌' }).first()
  const countBefore = await page.locator('.traytotal').textContent().catch(() => '')
  await plus.press('Enter')
  const countAfterEnter = await page.locator('.traytotal').textContent().catch(() => '')

  await page.locator('.pubbtn').first().press('Space')
  const sheetOpen = await page.locator('.sheet.on').count()
  const sheet = await page.locator('.sheet').evaluate(element => {
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
    const text = element.querySelector('.envtext')
    const textStyle = text ? getComputedStyle(text) : null
    const fieldStyle = getComputedStyle(element.querySelector('.envselect'))
    const publish = element.querySelector('.sheet-publish')
    const publishStyle = publish ? getComputedStyle(publish) : null
    return {
      rect: rect(element),
      currentEnvironmentText: text?.innerText || '',
      currentEnvironmentColor: textStyle?.color || '',
      environmentBackground: fieldStyle.backgroundColor,
      environmentTextContrastVisible: textStyle?.color !== fieldStyle.color && textStyle?.color !== 'rgb(255, 255, 255)',
      publishBackground: publishStyle?.backgroundColor || '',
      publishAriaDisabled: publish?.getAttribute('aria-disabled'),
      publishDisabledClass: publish?.classList.contains('disabled') || false,
      fields: [...element.querySelectorAll('.envselect,.sheet-input,.sheet-area')].map(rect),
      actions: [...element.querySelectorAll('.sheet-close,.sheet-draft,.sheet-publish')].map(rect),
    }
  })
  await page.screenshot({ path: path.join(out, `fresh-${viewport.width}x${viewport.height}-build-sheet.png`) })

  await page.locator('.envselect').press('Enter')
  const envExpandedByEnter = await page.locator('.envselect').getAttribute('aria-expanded')
  const envWheelVisible = await page.locator('.envwheel').isVisible().catch(() => false)
  await page.getByRole('button', { name: '确认环境选择' }).press('Space')
  const envCollapsedBySpace = await page.locator('.envselect').getAttribute('aria-expanded')

  await page.locator('.sheet-input input').fill('')
  const coverOptions = page.locator('.cover-choice')
  if (await coverOptions.count()) await coverOptions.first().press('Space')
  await page.locator('.sheet-publish').press('Enter')
  const invalidName = {
    sheetStillOpen: (await page.locator('.sheet.on').count()) === 1,
    feedbackVisible: (await page.locator('body').innerText()).includes('请输入卡组名'),
  }

  await page.locator('.sheet-input input').fill('Fresh QA 卡组')
  await page.locator('.sheet-area textarea').fill('Fresh QA fixture：仅验证本地状态，不发送外部写请求。')
  const storageBefore = await page.evaluate(() => localStorage.getItem('ptcg'))
  await page.locator('.sheet-draft').press('Space')
  const draftState = {
    sheetClosed: (await page.locator('.sheet.on').count()) === 0,
    storageChanged: storageBefore !== await page.evaluate(() => localStorage.getItem('ptcg')),
    feedbackVisible: (await page.locator('body').innerText()).includes('已保存'),
  }

  await page.locator('.pubbtn').first().click()
  const publishReady = {
    coverCount: await page.locator('.cover-choice').count(),
    name: await page.locator('.sheet-input input').getAttribute('value'),
    publishEnabled: await page.locator('.sheet-publish').isEnabled(),
    disabledSemanticsAvailable: (await page.locator('.sheet-publish').getAttribute('aria-disabled')) !== null,
  }
  await page.locator('.sheet-close').press('Enter')
  const sheetClosedByEnter = (await page.locator('.sheet.on').count()) === 0

  const focusProbe = await page.locator('.pubbtn').first().evaluate(async element => {
    element.focus()
    const s = getComputedStyle(element)
    return { active: document.activeElement === element, outline: s.outline, boxShadow: s.boxShadow }
  })

  renders.push({
    viewport,
    initial,
    interactions: {
      filters: { expandedEnterRows: expandedEnter.filterRows.length, collapsedSpaceRows: collapsedSpace.filterRows.length },
      view: { viewBefore, viewAfterEnter, viewAfterSpace, gridMode: gridEnter.poolMode, restoredMode: listSpace.poolMode },
      typeFilter: { cardsBeforeFilter, cardsAfterEnter: filteredEnter.cardCount, cardsAfterResetSpace: resetSpace.cardCount },
      search: { resultCount: searched.cardCount, firstResultText: searchedFirstResult },
      cardCount: { countBefore, countAfterEnter },
      sheetOpen,
      sheet,
      environment: { envExpandedByEnter, envWheelVisible, envCollapsedBySpace },
      invalidName,
      draftState,
      publishReady,
      sheetClosedByEnter,
      focusProbe,
    },
    externalWrites,
  })
  await context.close()
}

const regression = []
for (const route of ['plaza', 'detail', 'mine', 'event', 'round']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const suffix = route === 'detail' || route === 'event' ? '?id=0' : route === 'round' ? '?event=0&round=1' : ''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`, { waitUntil: 'networkidle', timeout: 30000 })
  const png = await page.screenshot({ fullPage: true })
  regression.push({
    route,
    sha256: crypto.createHash('sha256').update(png).digest('hex'),
    overflowX: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)),
    title: await page.title(),
  })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'browser-probes.json'), JSON.stringify({
  schema: 'heldout-build-minimal-fresh-qa/v1',
  attempt: 16,
  generatedAt: new Date().toISOString(),
  producerEvidenceConsumed: false,
  readOnlyExternalSystems: true,
  renders,
  regression,
}, null, 2) + '\n')
