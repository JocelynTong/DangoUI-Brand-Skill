import playwright from '../../../../node_modules/playwright-core/index.js'

const { chromium } = playwright

const url = 'http://127.0.0.1:10092/#/pages/build/index?mode=new'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function storageObject() {
  const storage = localStorage
  const value = {}
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i)
    value[key] = storage.getItem(key)
  }
  return value
}

async function createHarnessPage(browser, viewport = { width: 1280, height: 720 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const externalWrites = []
  await page.route('**/*', async route => {
    const request = route.request()
    const target = new URL(request.url())
    const external = !['127.0.0.1', 'localhost'].includes(target.hostname)
    const writeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
    if (external && writeMethod) {
      externalWrites.push({ method: request.method(), url: request.url() })
      await route.abort()
      return
    }
    await route.continue()
  })
  await page.addInitScript(() => {
    window.__duHarness = { storageWrites: [], beaconWrites: [] }
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      window.__duHarness.storageWrites.push({ key, value })
      return setItem.call(this, key, value)
    }
    const beacon = navigator.sendBeacon?.bind(navigator)
    if (beacon) {
      navigator.sendBeacon = (target, data) => {
        window.__duHarness.beaconWrites.push(String(target))
        return false
      }
    }
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  return { context, page, externalWrites }
}

async function openSheet(page) {
  await page.locator('.pubbtn').first().click()
  await page.locator('.sheet.on').waitFor()
}

async function restoreStorage(page, before) {
  await page.evaluate(snapshot => {
    localStorage.clear()
    for (const [key, value] of Object.entries(snapshot)) localStorage.setItem(key, value)
    window.__duHarness.storageWrites = []
  }, before)
  return page.evaluate(() => {
    const value = {}
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      value[key] = localStorage.getItem(key)
    }
    return value
  })
}

async function activationProbe(browser, activation) {
  const { context, page, externalWrites } = await createHarnessPage(browser)
  await openSheet(page)
  const before = await page.evaluate(storageObject)
  await page.evaluate(() => { window.__duHarness.storageWrites = [] })
  const button = page.locator('button.du-button.sheet-draft--du')
  if (activation === 'pointer') await button.click()
  else await button.press(activation)
  await page.waitForTimeout(50)
  const after = await page.evaluate(() => ({
    sheetOpen: document.querySelector('.sheet')?.classList.contains('on'),
    storageWrites: window.__duHarness.storageWrites.slice(),
    beaconWrites: window.__duHarness.beaconWrites.slice(),
  }))
  const restored = await restoreStorage(page, before)
  const exactRestore = JSON.stringify(restored) === JSON.stringify(before)
  await context.close()
  return {
    activation,
    sheetClosed: after.sheetOpen === false,
    storageWriteCount: after.storageWrites.length,
    storageWriteKeys: after.storageWrites.map(write => write.key),
    exactRestore,
    externalWrites,
    beaconWrites: after.beaconWrites,
  }
}

async function stateProbe(browser, state) {
  const { context, page, externalWrites } = await createHarnessPage(browser)
  await openSheet(page)
  const before = await page.evaluate(storageObject)
  const result = await page.locator('button.du-button.sheet-draft--du').evaluate((button, nextState) => {
    const instance = button.__vueParentComponent
    instance.props[nextState] = true
    const beforeWrites = window.__duHarness.storageWrites.length
    button.click()
    return new Promise(resolve => requestAnimationFrame(() => resolve({
      className: button.className,
      sheetOpen: document.querySelector('.sheet')?.classList.contains('on'),
      storageWriteDelta: window.__duHarness.storageWrites.length - beforeWrites,
    })))
  }, state)
  const restored = await restoreStorage(page, before)
  result.exactRestore = JSON.stringify(restored) === JSON.stringify(before)
  result.externalWrites = externalWrites
  await context.close()
  return { state, ...result }
}

async function keyboardProxyProbe(browser) {
  const { context, page, externalWrites } = await createHarnessPage(browser, { width: 390, height: 844 })
  await openSheet(page)
  const textarea = page.locator('.sheet-area--du textarea')
  await textarea.focus()
  await page.setViewportSize({ width: 390, height: 520 })
  await textarea.scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const sheet = document.querySelector('.sheet')
    const field = document.querySelector('.sheet-area--du')?.getBoundingClientRect()
    const viewportBottom = window.visualViewport?.height || innerHeight
    if (sheet && field && field.bottom > viewportBottom) {
      sheet.scrollTop += field.bottom - viewportBottom + 8
    }
  })
  await page.waitForTimeout(50)
  const result = await page.evaluate(() => {
    const field = document.querySelector('.sheet-area--du').getBoundingClientRect()
    const actions = document.querySelector('.sheet-actions').getBoundingClientRect()
    return {
      focused: document.activeElement?.matches('.sheet-area--du textarea'),
      visualViewportHeight: window.visualViewport?.height || innerHeight,
      textareaTop: field.top,
      textareaBottom: field.bottom,
      actionsTop: actions.top,
      actionsBottom: actions.bottom,
      textareaVisible: field.top >= 0 && field.bottom <= (window.visualViewport?.height || innerHeight),
      textareaAboveActions: field.bottom <= actions.top,
      sheetScrollTop: document.querySelector('.sheet')?.scrollTop || 0,
    }
  })
  result.externalWrites = externalWrites
  await context.close()
  return result
}

async function inputLimitProbe(browser) {
  const { context, page, externalWrites } = await createHarnessPage(browser, { width: 390, height: 844 })
  await openSheet(page)
  const name = page.locator('.sheet-input--du input')
  const textarea = page.locator('.sheet-area--du textarea')
  await page.evaluate(() => { window.__duHarness.storageWrites = [] })
  await name.fill('1234567890123456')
  await textarea.fill('介'.repeat(1001))
  const result = {
    nameLength: await name.inputValue(),
    descriptionLength: await textarea.inputValue(),
    storageWriteCount: await page.evaluate(() => window.__duHarness.storageWrites.length),
    externalWrites,
  }
  result.nameLength = result.nameLength.length
  result.descriptionLength = result.descriptionLength.length
  await context.close()
  return result
}

const browser = await chromium.launch({ headless: true, executablePath })
try {
  const activations = []
  for (const activation of ['pointer', 'Enter', 'Space']) {
    activations.push(await activationProbe(browser, activation))
  }
  const states = [await stateProbe(browser, 'disabled'), await stateProbe(browser, 'loading')]
  const keyboardProxy = await keyboardProxyProbe(browser)
  const inputLimits = await inputLimitProbe(browser)
  console.log(JSON.stringify({ activations, states, keyboardProxy, inputLimits }, null, 2))
} finally {
  await browser.close()
}
