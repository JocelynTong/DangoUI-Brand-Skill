import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const pageA = 'pokemon-tcg-official-home'
const pageB = 'pokemon-tcg-official-learn'
const route = (pageId) => `${baseUrl}/#/brand/pokemon-tcg-official/pages/${pageId}`
const hashRoute = (pageId) => `#/brand/pokemon-tcg-official/pages/${pageId}`
const outputFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'probe-result.json')

const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1184, height: 933 } })

async function waitForPage(pageId) {
  await page.waitForFunction(
    (expected) => document.querySelector('.source-schema-demo')?.dataset.pageId === expected,
    pageId,
  )
  await page.waitForTimeout(80)
}

async function metrics() {
  return page.locator('.phone-screen').evaluate((screen) => ({
    scrollTop: screen.scrollTop,
    scrollHeight: screen.scrollHeight,
    clientHeight: screen.clientHeight,
  }))
}

async function scrollAwayFromTop() {
  return page.locator('.phone-screen').evaluate((screen) => {
    screen.scrollTop = Math.min(420, screen.scrollHeight - screen.clientHeight)
    return screen.scrollTop
  })
}

async function switchPage(pageId) {
  await page.evaluate((hash) => { window.location.hash = hash }, hashRoute(pageId))
  await waitForPage(pageId)
}

try {
  await page.goto(route(pageA), { waitUntil: 'domcontentloaded' })
  await waitForPage(pageA)
  const pageAScrolled = await scrollAwayFromTop()

  await switchPage(pageB)
  const pageBInitial = await metrics()
  const pageBScrolled = await scrollAwayFromTop()

  await switchPage(pageA)
  const pageAReturned = await metrics()

  const checks = {
    pageAScrolled: pageAScrolled > 0,
    pageBInitialAtTop: pageBInitial.scrollTop === 0,
    pageBScrolled: pageBScrolled > 0,
    pageAReturnedAtTop: pageAReturned.scrollTop === 0,
  }
  const result = {
    schema: 'brand-demo-scroll-restore-probe/v1',
    brand: 'pokemon-tcg-official',
    sequence: { pageA, pageAScrolled, pageB, pageBInitial, pageBScrolled, pageAReturned },
    checks,
    passed: Object.values(checks).every(Boolean),
  }
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
} finally {
  await browser.close()
}
