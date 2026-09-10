import fs from 'node:fs/promises'
import path from 'node:path'
import playwright from '../../../../../node_modules/playwright-core/index.js'

const { chromium } = playwright
const root = path.dirname(new URL(import.meta.url).pathname)
const base = 'http://127.0.0.1:10092/#/'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const viewports = [{ width: 390, height: 844 }, { width: 536, height: 864 }, { width: 1280, height: 720 }]
const routes = ['pages/plaza/index', 'pages/build/index?mode=new', 'pages/mine/index', 'pages/event/index', 'pages/round/index', 'pages/detail/index']

await fs.mkdir(path.join(root, 'captures'), { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath })
const result = { generatedAt: new Date().toISOString(), build: {}, viewports: [], regression: [] }

function rect(el) {
  const r = el?.getBoundingClientRect()
  return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(`${base}pages/build/index?mode=new`, { waitUntil: 'networkidle' })
    await page.locator('.pubbtn').first().click()
    await page.locator('.sheet.on').waitFor()
    await page.waitForTimeout(500)
    const probe = await page.evaluate(() => {
      const rect = el => {
        const r = el?.getBoundingClientRect()
        return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }
      }
      const q = s => document.querySelector(s)
      const style = s => getComputedStyle(q(s))
      const fieldData = (rootSel, primitiveSel) => ({
        root: rect(q(rootSel)), primitive: rect(q(primitiveSel)),
        rootBorder: [style(rootSel).borderTopWidth, style(rootSel).borderTopStyle],
        primitiveBorder: [style(primitiveSel).borderTopWidth, style(primitiveSel).borderTopStyle],
        primitiveOutline: style(primitiveSel).outlineStyle,
      })
      const targets = ['.envselect', '.sheet-input--du', '.sheet-area--du', '.sheet-actions']
      const targetRects = Object.fromEntries(targets.map(s => [s, rect(q(s))]))
      const vw = innerWidth, vh = innerHeight
      return {
        runtimeCounts: { input: document.querySelectorAll('div.du-input').length, textarea: document.querySelectorAll('div.du-textarea').length, button: document.querySelectorAll('button.du-button').length },
        environmentText: q('.envselect')?.textContent?.trim(), targetRects,
        input: fieldData('.sheet-input--du', '.sheet-input--du input'),
        textarea: fieldData('.sheet-area--du', '.sheet-area--du textarea'),
        sheet: rect(q('.sheet')), sheetBody: { rect: rect(q('.sheet-body')), clientHeight: q('.sheet-body')?.clientHeight, scrollHeight: q('.sheet-body')?.scrollHeight, overflowY: style('.sheet-body').overflowY },
        horizontalContained: Object.values(targetRects).every(r => r && r.left >= 0 && r.right <= vw),
        verticalContained: Object.values(targetRects).every(r => r && r.top >= 0 && r.bottom <= vh),
        textareaAboveActions: targetRects['.sheet-area--du'].bottom <= targetRects['.sheet-actions'].top,
        documentHorizontalOverflow: document.documentElement.scrollWidth > vw,
      }
    })
    const name = page.locator('.sheet-input--du input')
    const area = page.locator('.sheet-area--du textarea')
    probe.placeholders = { name: await name.getAttribute('placeholder'), description: await area.getAttribute('placeholder') }
    await page.screenshot({ path: path.join(root, 'captures', `build-sheet-${viewport.width}x${viewport.height}-empty.png`) })
    await name.fill('名'.repeat(15))
    probe.name15 = (await name.inputValue()).length
    await name.fill('名'.repeat(16))
    probe.name16 = (await name.inputValue()).length
    await area.fill('介'.repeat(1000))
    probe.description1000 = (await area.inputValue()).length
    await area.fill('介'.repeat(1001))
    probe.description1001 = (await area.inputValue()).length
    probe.filled = { name: await name.inputValue(), descriptionLength: (await area.inputValue()).length }
    await area.focus()
    probe.focus = await area.evaluate(el => ({ active: document.activeElement === el, outline: getComputedStyle(el).outlineStyle }))
    probe.textareaScroll = await area.evaluate(el => { el.scrollTop = el.scrollHeight; return { clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, scrollable: el.scrollHeight > el.clientHeight && el.scrollTop > 0 } })
    await page.screenshot({ path: path.join(root, 'captures', `build-sheet-${viewport.width}x${viewport.height}.png`) })
    result.viewports.push({ viewport, ...probe })
    await context.close()
  }

  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push({ name: e.name, message: e.message, stack: e.stack }))
    await page.goto(base + route, { waitUntil: 'networkidle' })
    const probe = await page.evaluate(() => ({ title: document.title, bodyTextLength: document.body.innerText.length, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }))
    result.regression.push({ route, errors, ...probe })
    await context.close()
  }
} finally {
  await browser.close()
}

await fs.writeFile(path.join(root, 'browser-probes.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
