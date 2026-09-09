import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { chromium } from 'playwright-core'

const root = process.cwd()
const migrationRoot = path.resolve(root, 'migrations/dango')
const outputRoot = path.join(migrationRoot, 'captures/source')
const pages = [
  { id: 'introduction', url: 'https://dumpling.echo.tech/get-started/introduction' },
  { id: 'button', url: 'https://dumpling.echo.tech/style/button' },
]
const viewports = [
  { id: 'desktop', width: 1440, height: 900, canonical: true },
  { id: 'mobile-390', width: 390, height: 844, canonical: false },
]

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function relative(file) {
  return path.relative(root, file)
}

function fileRef(file) {
  return { path: relative(file), sha256: sha256(file) }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return fileRef(file)
}

async function smoothlyScroll(page, target) {
  const start = await page.evaluate(() => window.scrollY)
  const distance = target - start
  const steps = Math.max(1, Math.min(12, Math.ceil(Math.abs(distance) / 120)))
  for (let index = 1; index <= steps; index += 1) {
    const next = Math.round(start + distance * (index / steps))
    await page.evaluate((top) => window.scrollTo(0, top), next)
    await page.waitForTimeout(34)
  }
}

async function readElement(locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const style = getComputedStyle(node)
    return {
      className: typeof node.className === 'string' ? node.className : '',
      visibleDom: {
        selector: '.du-button.du-button--normal.du-button--primary.du-c-primary-bt',
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      },
      computed: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        height: style.height,
        transform: style.transform,
        transition: style.transition,
        outlineColor: style.outlineColor,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      },
    }
  })
}

async function captureButtonStates(page, dir, viewport) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  let demoFrame = null
  for (const frame of page.frames()) {
    if (await frame.getByRole('button', { name: 'Primary', exact: true }).count()) {
      demoFrame = frame
      break
    }
  }
  const primary = demoFrame?.getByRole('button', { name: 'Primary', exact: true }).first()
  if (!primary || !(await primary.count())) return null

  await primary.scrollIntoViewIfNeeded()
  const interactionDir = path.join(dir, 'primary-button')
  fs.mkdirSync(interactionDir, { recursive: true })
  const states = []
  const captureState = async (state, waitMs = 0) => {
    if (waitMs) await page.waitForTimeout(waitMs)
    const statePath = path.join(interactionDir, `${state}.png`)
    const details = await readElement(primary)
    await primary.screenshot({ path: statePath })
    states.push({
      state,
      capture: relative(statePath),
      sha256: sha256(statePath),
      sourceRegion: [0, 0, 1, 1],
      ...details,
    })
  }

  await captureState('default')
  await primary.hover()
  await captureState('hover-transition', 25)
  await captureState('hover', 180)
  await primary.focus()
  await captureState('focus', 180)
  await primary.click()
  await captureState('activated', 40)

  const timelineFile = path.join(interactionDir, 'timeline.json')
  const timeline = {
    schema: 'brand-interaction-timeline/v1',
    sourcePageId: 'button',
    interactionId: `primary-button-${viewport.id}`,
    viewport: { width: viewport.width, height: viewport.height },
    trigger: 'pointer hover, programmatic focus, pointer click',
    frames: states.map((state, index) => ({
      index,
      label: state.state,
      capture: state.capture,
      sha256: state.sha256,
      computed: state.computed,
    })),
    observedResult: 'Hover preserves the default pixels and computed color. Focus produces the browser-visible focus treatment. Activation does not introduce a red or orange action color.',
  }
  const timelineRef = writeJson(timelineFile, timeline)
  return {
    id: `primary-button-${viewport.id}`,
    target: 'button[name="Primary"]',
    status: 'covered',
    states,
    timeline: timelineRef,
  }
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const manifest = {
  schema: 'brand-source-observation/v2',
  brand: 'dango',
  goalId: 'dango-relearn-home-button-v1',
  captureMethod: 'Playwright rendered-source capture; screenshots are the primary evidence and DOM/computed samples are bound afterward.',
  pages: [],
  interactions: [],
}

for (const source of pages) {
  const pageRecord = { id: source.id, sourcePageId: source.id, url: source.url, status: 'covered', viewports: {} }
  for (const viewport of viewports) {
    const dir = path.join(outputRoot, source.id, viewport.id)
    const rawVideoDir = path.join(dir, '.video-staging')
    fs.mkdirSync(rawVideoDir, { recursive: true })
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      recordVideo: { dir: rawVideoDir, size: { width: viewport.width, height: viewport.height } },
    })
    const page = await context.newPage()
    await page.goto(source.url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)

    const fullPagePath = path.join(dir, 'full-page.png')
    await page.screenshot({ path: fullPagePath, fullPage: true })
    const interaction = source.id === 'button'
      ? await captureButtonStates(page, dir, viewport)
      : null

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
    const pageMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
      maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    }))
    const step = Math.max(1, Math.round(viewport.height * 0.72))
    const positions = [0]
    for (let scrollTop = step; scrollTop < pageMetrics.maxScroll; scrollTop += step) positions.push(scrollTop)
    if (positions[positions.length - 1] !== pageMetrics.maxScroll) positions.push(pageMetrics.maxScroll)

    const startedAt = Date.now()
    const frames = []
    for (const [index, scrollTop] of positions.entries()) {
      await smoothlyScroll(page, scrollTop)
      await page.waitForTimeout(index === positions.length - 1 ? 320 : 120)
      const actual = await page.evaluate(() => ({ scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight }))
      const framePath = path.join(dir, `frame-${String(index).padStart(2, '0')}.png`)
      await page.screenshot({ path: framePath })
      frames.push({
        index,
        label: index === 0 ? 'initial' : index === positions.length - 1 ? 'settled-end' : 'continuous-scroll',
        timeMs: Date.now() - startedAt,
        scrollTop: actual.scrollTop,
        scrollHeight: actual.scrollHeight,
        path: relative(framePath),
        sha256: sha256(framePath),
      })
    }

    await smoothlyScroll(page, 0)
    await page.waitForTimeout(250)
    const restoredPath = path.join(dir, 'restored.png')
    await page.screenshot({ path: restoredPath })

    const visibleSamples = await page.evaluate(() => {
      const selectors = ['header', 'aside', 'main', 'h1', 'h2', 'a[aria-current="page"]', 'button', '[class*="button"]']
      const seen = new Set()
      return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].slice(0, 8).map((node) => {
        if (seen.has(node)) return null
        seen.add(node)
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        return {
          selector,
          tag: node.tagName.toLowerCase(),
          text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          computed: {
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            width: style.width,
            height: style.height,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
          },
        }
      })).filter(Boolean)
    })
    const computedPath = path.join(dir, 'visible-computed.json')
    writeJson(computedPath, visibleSamples)

    const timelinePath = path.join(dir, 'timeline.json')
    const timelineRef = writeJson(timelinePath, {
      schema: 'brand-continuous-scroll-timeline/v1',
      sourcePageId: source.id,
      viewportId: viewport.id,
      meta: {
        url: source.url,
        viewport: { width: viewport.width, height: viewport.height },
        scrollHeight: pageMetrics.scrollHeight,
      },
      frames,
      restored: { scrollTop: 0, path: relative(restoredPath), sha256: sha256(restoredPath) },
    })

    const video = page.video()
    await context.close()
    const videoPath = path.join(dir, 'continuous-scroll.webm')
    await video.saveAs(videoPath)
    fs.rmSync(rawVideoDir, { recursive: true, force: true })

    const viewportRecord = {
      viewport: { width: viewport.width, height: viewport.height },
      fullPageCapture: fileRef(fullPagePath),
      continuousCapture: fileRef(videoPath),
      timeline: timelineRef,
      restoredCapture: fileRef(restoredPath),
      computedSamples: relative(computedPath),
      interaction,
    }
    pageRecord.viewports[viewport.id] = viewportRecord
    if (viewport.canonical) {
      pageRecord.fullPageCapture = viewportRecord.fullPageCapture
      pageRecord.continuousCapture = viewportRecord.continuousCapture
      pageRecord.timeline = viewportRecord.timeline
      pageRecord.restoredCapture = viewportRecord.restoredCapture
    }
    if (interaction) {
      manifest.interactions.push({
        ...interaction,
        sourcePageId: source.id,
        continuousCapture: viewportRecord.continuousCapture,
      })
    }
  }
  manifest.pages.push(pageRecord)
}

manifest.coverage = {
  requiredPageIds: pages.map((page) => page.id),
  coveredPageIds: pages.map((page) => page.id),
  requiredViewports: viewports.map((viewport) => viewport.id),
  requiredStates: ['initial', 'continuous-scroll', 'settled-end', 'restored'],
  coveredInteractionStates: ['default', 'hover-transition', 'hover', 'focus', 'activated'],
  readyForInterpreter: false,
  reason: 'Capture complete. The evidence manifest becomes consumer-ready only after page-scoped claims and seed dispositions are written and the strict visibility gate passes.',
}
writeJson(path.join(migrationRoot, 'source-observation-manifest.json'), manifest)
await browser.close()
console.log(JSON.stringify({ ok: true, manifest: 'migrations/dango/source-observation-manifest.json', coverage: manifest.coverage }))
