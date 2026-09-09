import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import {
  PREVIEW_BLOCKER_CODES,
  getScrollContract,
  validateScrollProbe,
  validateContentCoverage,
  validateHomeIndicatorProbe,
  validateBrandIconProbe,
  validateBrandRailLabelProbe,
} from './brand-preview-layout-contract.mjs'

const root = process.cwd()
const errors = []
const warnings = []

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] || fallback : fallback
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function fail(scope, message) {
  errors.push(`${scope}: ${message}`)
}

function warn(scope, message) {
  warnings.push(`${scope}: ${message}`)
}

function blocker(scope, code, message) {
  errors.push(`${scope}: ${code}: ${message}`)
}

function cssString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function findChromeExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean)
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function loadPreview(brandId) {
  const registryFile = path.resolve(root, 'public/brand-previews/registry.json')
  const registry = readJson(registryFile)
  const entries = Array.isArray(registry.brands) ? registry.brands : []
  const entry = brandId ? entries.find((item) => item.id === brandId) : entries[0]
  if (!entry) throw new Error(`No brand preview found${brandId ? ` for ${brandId}` : ''}`)
  const previewFile = path.resolve(root, 'public', entry.path.replace(/^\/+/, ''))
  const sourceEvidence = {}
  for (const name of ['brand-evidence.json', 'site-evidence.json', 'goal-contract.json']) {
    const migrationEvidenceFile = path.resolve(root, entry.migrationRoot || '', name)
    if (fs.existsSync(migrationEvidenceFile)) {
      sourceEvidence[name.replace(/\.json$/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = readJson(migrationEvidenceFile)
    }
  }
  return { entry, preview: readJson(previewFile), sourceEvidence }
}

function isFlipSection(section) {
  if (!section || typeof section !== 'object') return false
  if (String(section.type || '').includes('flip')) return true
  const interaction = section.interaction
  if (typeof interaction === 'string') return interaction.includes('flip')
  if (interaction && typeof interaction === 'object') return Object.values(interaction).some((value) => String(value).includes('flip'))
  return false
}

async function validateSectionOrder(page, brandId, pageConfig) {
  const expected = pageConfig.sections.map((section) => section.type)
  const selector = `.source-schema-demo[data-page-id="${cssString(pageConfig.id)}"] > [data-schema-section-type]`
  const actual = await page.$$eval(selector, (nodes) => nodes.map((node) => node.getAttribute('data-schema-section-type')))

  if (actual.length !== expected.length) {
    fail(`${brandId}/${pageConfig.id}`, `DOM rendered ${actual.length} schema section(s), expected ${expected.length}`)
    return actual
  }

  const mismatchIndex = expected.findIndex((type, index) => type !== actual[index])
  if (mismatchIndex >= 0) {
    fail(
      `${brandId}/${pageConfig.id}`,
      `section order mismatch at ${mismatchIndex}: expected ${expected[mismatchIndex]}, got ${actual[mismatchIndex]}`
    )
  }
  return actual
}

async function validateShell(page, brandId, pageConfig) {
  const scope = `${brandId}/${pageConfig.id}`
  const shellFields = [
    ['statusBar', '.mock-statusbar'],
    ['navigationBar', '.du-navigation-bar__wrapper'],
    ['bottomActions', '.mock-bottom-actionbar, .demo-bottom-tabbar'],
    ['fab', '.demo-publish-fab'],
  ]

  const result = await page.evaluate(
    ({ pageId, shellFields }) => {
      const demo = document.querySelector(`.source-schema-demo[data-page-id="${CSS.escape(pageId)}"]`)
      const screen = demo?.closest('.phone-screen')
      const phone = screen?.closest('.phone')
      const frame = screen?.closest('.template-preview')
      if (!screen || !phone || !frame) {
        return {
          missingScreen: !screen,
          missingPhone: !phone,
          missingFrame: !frame,
          counts: {},
        }
      }
      const counts = {}
      for (const [field, selector] of shellFields) {
        counts[field] = screen.querySelectorAll(selector).length
      }
      return { missingScreen: false, missingPhone: false, missingFrame: false, counts }
    },
    { pageId: pageConfig.id, shellFields },
  )

  if (result.missingScreen || result.missingPhone || result.missingFrame) {
    blocker(
      scope,
      PREVIEW_BLOCKER_CODES.MOCKUP_SHELL_MISSING,
      `standard demo page must remain inside the mockup shell (screen=${!result.missingScreen}, phone=${!result.missingPhone}, frame=${!result.missingFrame})`,
    )
    return
  }

  const shell = pageConfig.shell || {}
  for (const [field] of shellFields) {
    if (typeof shell[field] !== 'boolean') {
      fail(scope, `shell.${field} must be explicitly declared as boolean`)
    }
    if (shell[field] === false && result.counts[field] > 0) {
      fail(scope, `shell.${field}=false but DOM contains ${result.counts[field]} matching node(s)`)
    }
  }
}

async function validateUnsupportedSections(page, brandId, pageConfig) {
  const unsupported = await page.evaluate(({ pageId }) => {
    const demo = document.querySelector(`.source-schema-demo[data-page-id="${CSS.escape(pageId)}"]`)
    if (!demo) return []
    return Array.from(demo.querySelectorAll('.source-schema-demo__unsupported'))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
  }, { pageId: pageConfig.id })

  for (const text of unsupported) {
    fail(`${brandId}/${pageConfig.id}`, `unsupported schema section rendered: ${text}`)
  }
}

async function validateImages(page, brandId, pageConfig) {
  const selector = `.source-schema-demo[data-page-id="${cssString(pageConfig.id)}"] img`
  const images = await page.$$eval(selector, (nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect()
      const section = node.closest('[data-schema-section-type]')
      const sectionRect = section?.getBoundingClientRect()
      return {
        src: node.currentSrc || node.src || '',
        complete: node.complete,
        naturalWidth: node.naturalWidth,
        naturalHeight: node.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        left: rect.left,
        right: rect.right,
        sectionType: section?.getAttribute('data-schema-section-type') || '',
        sectionWidth: sectionRect?.width || 0,
        sectionLeft: sectionRect?.left || 0,
        sectionRight: sectionRect?.right || 0,
      }
    })
  )

  const broken = images.filter(
    (image) =>
      image.renderedWidth > 1 &&
      image.renderedHeight > 1 &&
      (!image.complete || image.naturalWidth < 1 || image.naturalHeight < 1)
  )
  for (const image of broken) fail(`${brandId}/${pageConfig.id}`, `image failed to load: ${image.src || '<empty src>'}`)
  const stripOverflow = images.filter(
    (image) =>
      /card-strip/.test(image.sectionType) &&
      image.sectionWidth > 0 &&
      (image.renderedWidth > Math.min(image.sectionWidth - 8, 180) ||
        image.renderedHeight > 220 ||
        image.left < image.sectionLeft - 2 ||
        image.right > image.sectionRight + 2)
  )
  for (const image of stripOverflow) {
    fail(
      `${brandId}/${pageConfig.id}`,
      `asset strip image is oversized or overflowing in ${image.sectionType}: ${Math.round(image.renderedWidth)}x${Math.round(image.renderedHeight)} (${image.src || '<empty src>'})`
    )
  }
  return images.length
}

async function validateScroll(page, brandId, pageConfig, preview, sourceEvidence) {
  const contract = getScrollContract({ page: pageConfig, preview, sourceEvidence })
  const result = await page.evaluate(({ pageId, required }) => {
    const screen = document.querySelector(`.source-schema-demo[data-page-id="${CSS.escape(pageId)}"]`)?.closest('.phone-screen')
    if (!screen) return { required, missingScreen: true, changed: false, restored: false, clientHeight: 0, scrollHeight: 0 }
    const before = screen.scrollTop
    const clientHeight = screen.clientHeight
    const scrollHeight = screen.scrollHeight
    const screenRect = screen.getBoundingClientRect()
    const sections = [...screen.querySelectorAll('.source-schema-demo > section')]
    const contentBottom = sections.reduce((max, section) => {
      const rect = section.getBoundingClientRect()
      return Math.max(max, rect.bottom - screenRect.top + before)
    }, 0)
    if (!required || scrollHeight <= clientHeight) {
      return { required, before, after: before, restoredTop: before, changed: false, restored: true, clientHeight, scrollHeight, contentBottom }
    }
    const maxScroll = scrollHeight - clientHeight
    const target = before === 0 ? Math.min(maxScroll, Math.max(1, Math.floor(maxScroll / 2))) : 0
    screen.scrollTop = target
    const after = screen.scrollTop
    const changed = after !== before
    screen.scrollTop = before
    const restoredTop = screen.scrollTop
    return { required, before, after, restoredTop, changed, restored: restoredTop === before, clientHeight, scrollHeight, contentBottom }
  }, { pageId: pageConfig.id, required: contract.required })

  if (result.missingScreen) return { ...result, contract }
  for (const finding of validateScrollProbe(result, contract)) {
    blocker(`${brandId}/${pageConfig.id}`, finding.code, `${finding.message}; evidence=${contract.reasons.join('; ')}`)
  }
  for (const finding of validateContentCoverage(result, contract)) {
    blocker(`${brandId}/${pageConfig.id}`, finding.code, `${finding.message}; evidence=${contract.reasons.join('; ')}`)
  }
  return { ...result, contract }
}

async function validateHomeIndicator(page, brandId, pageConfig) {
  const result = await page.evaluate(({ pageId }) => {
    const demo = document.querySelector(`.source-schema-demo[data-page-id="${CSS.escape(pageId)}"]`)
    const screen = demo?.closest('.phone-screen')
    const phone = screen?.closest('.phone')
    const contents = screen?.querySelector(':scope > .contents')
    const indicator = phone?.querySelector(':scope > .mock-home-indicator--outer')
    const bar = indicator?.querySelector('span')
    if (!demo?.classList.contains('source-schema-demo--home')) return { notApplicable: true }
    if (!phone || !screen || !indicator || !bar) return { missing: true }
    const phoneRect = phone.getBoundingClientRect()
    const indicatorRect = indicator.getBoundingClientRect()
    const barRect = bar.getBoundingClientRect()
    const indicatorStyle = getComputedStyle(indicator)
    const color = indicatorStyle.backgroundColor.match(/[\d.]+/g)?.map(Number) || []
    return {
      missing: false,
      position: indicatorStyle.position,
      parentIsPhone: indicator.parentElement === phone,
      insideChassisBounds: indicatorRect.left >= phoneRect.left - .5
        && indicatorRect.right <= phoneRect.right + .5
        && indicatorRect.bottom <= phoneRect.bottom + .5,
      backgroundFullyTransparent: indicatorStyle.backgroundImage === 'none'
        && (color.length === 4 ? color[3] === 0 : false),
      barVisible: barRect.width > 1 && barRect.height > 1 && getComputedStyle(bar).visibility !== 'hidden',
      contentSafeInset: parseFloat(getComputedStyle(contents).paddingBottom) || 0,
      sourceRootBottomPadding: parseFloat(getComputedStyle(demo).paddingBottom) || 0,
      minimumSafeInset: 12 * (parseFloat(getComputedStyle(phone).getPropertyValue('--mockup-scale')) || 1),
      indicatorHeight: indicatorRect.height,
    }
  }, { pageId: pageConfig.id })
  if (result.notApplicable || result.missing) return
  for (const finding of validateHomeIndicatorProbe(result)) {
    blocker(`${brandId}/${pageConfig.id}`, finding.code, finding.message)
  }
}

async function validateBrandRailIcons(page, brandId, pageConfig) {
  const result = await page.$$eval('.style-switcher .site-icon', (nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return {
      loaded: node.complete && node.naturalWidth > 0 && node.naturalHeight > 0,
      visible: rect.width > 0 && rect.height > 0 && getComputedStyle(node).display !== 'none',
      objectFit: getComputedStyle(node).objectFit,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight,
    }
  }))
  for (const finding of validateBrandIconProbe(result)) {
    blocker(`${brandId}/${pageConfig.id}`, finding.code, finding.message)
  }
}

async function validateBrandRailLabels(page, brandId, pageConfig) {
  const result = await page.$$eval('.style-switcher .style-button', (nodes) => nodes.map((node) => {
    const label = node.querySelector('span')
    const style = getComputedStyle(label)
    return {
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      title: node.getAttribute('title') || '',
    }
  }))
  for (const finding of validateBrandRailLabelProbe(result)) {
    blocker(`${brandId}/${pageConfig.id}`, finding.code, finding.message)
  }
}

async function validateFlip(page, brandId, pageConfig) {
  if (!pageConfig.sections.some(isFlipSection)) return 'not-declared'

  const selector = '.source-schema-demo [data-schema-section-type*="flip"] .source-schema-demo__card-transformer'
  const cards = page.locator(selector)
  const count = await cards.count()
  if (!count) {
    fail(`${brandId}/${pageConfig.id}`, 'flip interaction declared but no flip card DOM was rendered')
    return 'missing-dom'
  }

  let card = null
  for (let index = 0; index < count; index += 1) {
    const candidate = cards.nth(index)
    await candidate.scrollIntoViewIfNeeded().catch(() => {})
    const visible = await candidate
      .evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none'
      })
      .catch(() => false)
    if (visible) {
      card = candidate
      break
    }
  }

  if (!card) {
    fail(`${brandId}/${pageConfig.id}`, 'flip interaction declared but no visible flip card DOM was rendered')
    return 'hidden-dom'
  }

  const before = await card.evaluate((node) => getComputedStyle(node).transform)
  try {
    await card.hover({ timeout: 10000 })
  } catch (error) {
    fail(
      `${brandId}/${pageConfig.id}`,
      `flip interaction declared but flip card is not hoverable (${String(error.message).split('\n')[0]})`
    )
    return 'not-hoverable'
  }
  await page.waitForTimeout(300)
  const after = await card.evaluate((node) => getComputedStyle(node).transform)
  if (before === after) {
    fail(`${brandId}/${pageConfig.id}`, `flip interaction declared but transform did not change (${before})`)
  }
  return before === after ? 'unchanged' : 'changed'
}

async function validatePage(browser, baseUrl, brandId, pageConfig, preview, sourceEvidence) {
  // Use the frozen QA viewport from the learn-brand contract. A taller host
  // window can make a genuine phone long page fit entirely and would turn the
  // scroll probe into an environment-dependent false failure.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const url = `${baseUrl.replace(/\/+$/, '')}/#/brand/${brandId}/pages/${pageConfig.id}`
  const scope = `${brandId}/${pageConfig.id}`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector(`.source-schema-demo[data-page-id="${cssString(pageConfig.id)}"]`, { timeout: 10000 })
    await page.waitForTimeout(600)

    await validateShell(page, brandId, pageConfig)
    await validateBrandRailIcons(page, brandId, pageConfig)
    await validateBrandRailLabels(page, brandId, pageConfig)
    await validateHomeIndicator(page, brandId, pageConfig)
    await validateUnsupportedSections(page, brandId, pageConfig)
    const sections = await validateSectionOrder(page, brandId, pageConfig)
    const imageCount = await validateImages(page, brandId, pageConfig)
    const scroll = await validateScroll(page, brandId, pageConfig, preview, sourceEvidence)
    const flip = await validateFlip(page, brandId, pageConfig)

    console.log(
      `brand-preview-browser: ${scope} sections=${sections.join('>')} images=${imageCount} scroll=${scroll.required ? (scroll.changed && scroll.restored ? 'ok' : 'blocked') : 'not-needed'} flip=${flip}`
    )
  } catch (error) {
    fail(scope, error.message)
  } finally {
    await page.close()
  }
}

async function main() {
  const baseUrl = arg('base-url', 'http://127.0.0.1:5173')
  const brandId = arg('brand', '')
  const pageId = arg('page', '')
  const executablePath = findChromeExecutable()
  if (!executablePath) {
    throw new Error('No local Chrome/Chromium executable found for browser preview validation')
  }

  const { entry, preview, sourceEvidence } = loadPreview(brandId)
  const pages = (preview.pages || []).filter((pageConfig) => Array.isArray(pageConfig.sections) && pageConfig.sections.length)
  const selectedPages = pageId ? pages.filter((pageConfig) => pageConfig.id === pageId) : pages
  if (!selectedPages.length) throw new Error(`No schema-driven page found${pageId ? ` for ${pageId}` : ''}`)

  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const pageConfig of selectedPages) await validatePage(browser, baseUrl, entry.id, pageConfig, preview, sourceEvidence)
  } finally {
    await browser.close()
  }

  for (const warning of warnings) console.warn(`brand-preview-browser warning: ${warning}`)
  if (errors.length) {
    for (const error of errors) console.error(`brand-preview-browser failed: ${error}`)
    process.exit(1)
  }
  console.log(`brand-preview-browser summary: ${selectedPages.length} page(s) ok`)
}

main().catch((error) => {
  console.error(`brand-preview-browser failed: ${error.message}`)
  process.exit(1)
})
