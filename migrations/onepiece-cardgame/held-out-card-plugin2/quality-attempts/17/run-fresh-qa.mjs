import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const out = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/pages/build/index'
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })

const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
const luminance = color => {
  const values = rgb(color).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
}
const visible = locator => locator.isVisible().catch(() => false)
const results = []

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const writes = []
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push({ method: request.method(), url: request.url() })
  })
  await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 })

  const initial = await page.evaluate(() => ({
    overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    poolMode: document.querySelector('.poolgrid') ? 'grid' : 'list',
    cardCount: document.querySelectorAll('.lrow,.pgcard').length,
    trayVisible: !!document.querySelector('.tray') && getComputedStyle(document.querySelector('.tray')).display !== 'none',
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    bodyText: document.body.innerText.slice(0, 500),
  }))

  const more = page.locator('.filter-more')
  await more.press('Enter')
  const expandedRows = await page.locator('.filter-row').count()
  await more.press('Space')
  const collapsedRows = await page.locator('.filter-row').count()

  const view = page.locator('.viewtoggle')
  await view.press('Enter')
  const gridByEnter = (await page.locator('.poolgrid').count()) === 1
  await view.press('Space')
  const listRestoredBySpace = (await page.locator('.poollist').count()) === 1

  const type = page.getByRole('button', { name: '宝可梦', exact: true }).first()
  await type.press('Enter')
  const filteredCount = await page.locator('.lrow,.pgcard').count()
  await page.getByRole('button', { name: '全部', exact: true }).first().press('Space')
  const resetCount = await page.locator('.lrow,.pgcard').count()

  const search = page.locator('.b-search-in input')
  await search.fill('超梦')
  const searchCount = await page.locator('.lrow,.pgcard').count()
  const searchFirst = await page.locator('.lrow-name,.pg-name').first().textContent().catch(() => '')
  await search.fill('')

  await page.locator('.pubbtn').first().click()
  const env = page.locator('.envselect')
  const envStyle = await env.evaluate(element => {
    const text = element.querySelector('.envtext')
    const ts = getComputedStyle(text)
    const es = getComputedStyle(element)
    return { value: text?.textContent?.trim() || '', color: ts.color, background: es.backgroundColor }
  })
  envStyle.contrast = contrast(envStyle.color, envStyle.background)

  const activate = async gesture => {
    if ((await env.getAttribute('aria-expanded')) === 'true') await env.click()
    const before = await env.getAttribute('aria-expanded')
    await env.evaluate(element => {
      element.dataset.qaAriaMutations = '0'
      const observer = new MutationObserver(records => {
        const count = Number(element.dataset.qaAriaMutations || 0)
        element.dataset.qaAriaMutations = String(count + records.filter(r => r.attributeName === 'aria-expanded').length)
      })
      observer.observe(element, { attributes: true, attributeFilter: ['aria-expanded'] })
      window.__qaEnvObserver = observer
    })
    if (gesture === 'pointer') await env.click()
    else { await env.focus(); await page.keyboard.press(gesture) }
    await page.waitForTimeout(80)
    const opened = {
      before,
      expanded: await env.getAttribute('aria-expanded'),
      wheelVisible: await visible(page.locator('.envpicker')),
      mutations: Number(await env.getAttribute('data-qa-aria-mutations') || 0),
    }
    if (gesture === 'pointer') await env.click()
    else { await env.focus(); await page.keyboard.press(gesture) }
    await page.waitForTimeout(80)
    opened.closedOnSecondActivation = (await env.getAttribute('aria-expanded')) === 'false'
    await env.evaluate(element => { window.__qaEnvObserver?.disconnect(); delete window.__qaEnvObserver; delete element.dataset.qaAriaMutations })
    return opened
  }
  const activation = {
    pointer: await activate('pointer'),
    enter: await activate('Enter'),
    space: await activate('Space'),
  }

  await env.click()
  await page.locator('.cover-row').click({ position: { x: 4, y: 4 } })
  const parentTapPreserved = (await env.getAttribute('aria-expanded')) === 'false'

  if ((await env.getAttribute('aria-expanded')) !== 'true') await env.click()
  await page.screenshot({ path: path.join(out, `fresh-${viewport.width}x${viewport.height}-build-env.png`) })
  await env.click()

  const publish = page.locator('.sheet-publish')
  const preSubmit = {
    active: await publish.isEnabled(),
    ariaDisabled: await publish.getAttribute('aria-disabled'),
    submittingSemanticsPresent: await publish.getAttribute('aria-busy'),
  }
  await page.locator('.sheet-input input').fill('')
  await publish.click()
  const invalid = {
    sheetOpen: (await page.locator('.sheet.on').count()) === 1,
    feedbackVisible: /请选择封面|请输入卡组名|不符合发布规则/.test(await page.locator('body').innerText()),
    publishStillActive: await publish.isEnabled(),
  }

  await page.locator('.sheet-input input').fill('Fresh QA draft')
  await page.locator('.sheet-area textarea').fill('Fresh independent QA local draft')
  const storageBefore = await page.evaluate(() => localStorage.getItem('ptcg'))
  await page.locator('.sheet-draft').press('Space')
  const draft = {
    sheetClosed: (await page.locator('.sheet.on').count()) === 0,
    localStorageChanged: storageBefore !== await page.evaluate(() => localStorage.getItem('ptcg')),
    feedbackVisible: /已保存/.test(await page.locator('body').innerText()),
  }

  const focus = await page.locator('.pubbtn').first().evaluate(element => {
    element.focus(); const style = getComputedStyle(element)
    return { active: document.activeElement === element, outline: style.outline, boxShadow: style.boxShadow }
  })
  const targetSizing = await page.evaluate(() => [...document.querySelectorAll('[role="button"],[role="tab"]')]
    .filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width && r.height })
    .map(el => { const r = el.getBoundingClientRect(); return { label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 40), width: r.width, height: r.height } })
    .filter(x => x.width < 44 || x.height < 44))

  results.push({ viewport, initial, regression: { expandedRows, collapsedRows, gridByEnter, listRestoredBySpace, filteredCount, resetCount, searchCount, searchFirst }, envStyle, activation, parentTapPreserved, preSubmit, invalid, draft, focus, targetSizing, externalWrites: writes })
  await context.close()
}

const otherRoutes = []
for (const route of ['plaza', 'detail', 'mine', 'event', 'round']) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const writes = []
  page.on('request', r => { if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push({ method: r.method(), url: r.url() }) })
  const suffix = route === 'detail' || route === 'event' ? '?id=0' : route === 'round' ? '?event=0&round=1' : ''
  await page.goto(`http://127.0.0.1:10092/#/pages/${route}/index${suffix}`, { waitUntil: 'networkidle', timeout: 30000 })
  const png = await page.screenshot({ fullPage: true })
  otherRoutes.push({ route, sha256: crypto.createHash('sha256').update(png).digest('hex'), overflowX: await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)), writes })
  await context.close()
}

await browser.close()
await fs.writeFile(path.join(out, 'browser-probes.json'), JSON.stringify({ schema: 'heldout-build-fresh-independent-qa/v1', attempt: 17, generatedAt: new Date().toISOString(), producerEvidenceConsumed: false, readOnlyExternalSystems: true, results, otherRoutes }, null, 2) + '\n')
