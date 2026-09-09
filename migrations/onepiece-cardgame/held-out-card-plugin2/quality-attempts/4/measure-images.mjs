import { chromium } from 'playwright-core'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = '/Users/jocelyn/Downloads/vibecoding-docs-demo'
const attempt3 = path.join(root, 'migrations/onepiece-cardgame/held-out-card-plugin2/quality-attempts/3')
const attempt4 = path.join(root, 'migrations/onepiece-cardgame/held-out-card-plugin2/quality-attempts/4')
const refs = {
  sourceHome: path.join(root, 'output/visual-qa/onepiece-cardgame/evidence-v4/full-pages/source-home-full.png'),
  sourceProducts: path.join(root, 'output/visual-qa/onepiece-cardgame/evidence-v4/full-pages/source-products-full.png'),
  sourceEvents: path.join(root, 'output/visual-qa/onepiece-cardgame/evidence-v4/full-pages/source-events-full.png'),
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const page = await browser.newPage()

async function loadImage(file) {
  const dataUrl = `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`
  return page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data
    const total = c.width * c.height
    let warm = 0, dark = 0, red = 0, yellow = 0, white = 0, navy = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
      const lum = .2126 * r + .7152 * g + .0722 * b
      if (r >= 218 && g >= 210 && b >= 180 && Math.max(r, g, b) - Math.min(r, g, b) <= 65) warm++
      if (lum < 72) dark++
      if (b > r * 1.2 && b > g * 1.05 && lum < 105) navy++
      if (r > 135 && r > g * 1.4 && r > b * 1.3) red++
      if (r > 180 && g > 150 && b < 105) yellow++
      if (r > 244 && g > 244 && b > 244) white++
    }
    const ratio = n => Number((n / total).toFixed(4))
    return { src, width: c.width, height: c.height, metrics: { width: c.width, height: c.height, warmRatio: ratio(warm), darkRatio: ratio(dark), navyRatio: ratio(navy), redRatio: ratio(red), yellowRatio: ratio(yellow), nearWhiteRatio: ratio(white) } }
  }, dataUrl)
}

async function diff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { sameDimensions: false, a: [a.width, a.height], b: [b.width, b.height] }
  return page.evaluate(async ({ a, b }) => {
    const load = async src => { const img = new Image(); img.src = src; await img.decode(); return img }
    const [ia, ib] = await Promise.all([load(a.src), load(b.src)])
    const c = document.createElement('canvas'); c.width = ia.naturalWidth; c.height = ia.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(ia, 0, 0); const pa = ctx.getImageData(0, 0, c.width, c.height).data
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(ib, 0, 0); const pb = ctx.getImageData(0, 0, c.width, c.height).data
    let changed = 0, strong = 0, sum = 0; const total = c.width * c.height
    for (let i = 0; i < pa.length; i += 4) { const d = Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]); sum += d; if (d > 6) changed++; if (d > 45) strong++ }
    return { sameDimensions: true, changedPixelRatio: Number((changed / total).toFixed(6)), strongChangedPixelRatio: Number((strong / total).toFixed(6)), meanRgbAbsSum: Number((sum / total).toFixed(3)) }
  }, { a, b })
}

const oldMobile = await loadImage(path.join(attempt3, 'mobile-390x844-plaza.png'))
const oldDesktop = await loadImage(path.join(attempt3, 'desktop-1280x720-plaza.png'))
const newMobile = await loadImage(path.join(attempt4, 'mobile-390x844-plaza-fresh.png'))
const newDesktop = await loadImage(path.join(attempt4, 'desktop-1280x720-plaza-fresh.png'))
const artifact = {
  plaza: {
    old: { mobile: oldMobile.metrics, desktop: oldDesktop.metrics },
    fresh: { mobile: newMobile.metrics, desktop: newDesktop.metrics },
    delta: { mobile: await diff(oldMobile, newMobile), desktop: await diff(oldDesktop, newDesktop) },
  },
  sources: {},
  siblingRegression: [],
}
for (const [id, file] of Object.entries(refs)) artifact.sources[id] = (await loadImage(file)).metrics
for (const route of ['build', 'detail', 'event', 'mine', 'round']) {
  for (const viewport of ['mobile-390x844', 'desktop-1280x720']) {
    const a = await loadImage(path.join(attempt3, `${viewport}-${route}.png`))
    const b = await loadImage(path.join(attempt4, `${viewport}-${route}-fresh.png`))
    artifact.siblingRegression.push({ route, viewport, old: a.metrics, fresh: b.metrics, diff: await diff(a, b) })
  }
}
await browser.close()
await fs.writeFile(path.join(attempt4, 'image-measurements.json'), JSON.stringify(artifact, null, 2) + '\n')
