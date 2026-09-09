import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5177'
const outputDir = path.resolve('migrations/pokemon-tcg-official/quality-attempts/10/demo-revision5')
const captureDir = path.join(outputDir, 'captures')
fs.mkdirSync(captureDir, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const route = '#/brand/pokemon-tcg-official/pages/pokemon-tcg-official-pocket-fixture'
const surfaces = [{ id: 'desktop-1440', width: 1440, height: 900, query: '?qa=attempt10-revision5&proof=desktop' }, { id: 'mobile-390', width: 390, height: 844, query: '?qa=attempt10-revision5' }]
const results = []

for (const surface of surfaces) {
  const page = await browser.newPage({ viewport: { width: surface.width, height: surface.height }, deviceScaleFactor: 1 })
  const errors = [], warnings = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${baseUrl}/${surface.query}${route}`, { waitUntil: 'networkidle' })
  const fixture = page.locator('[data-schema-section-id="held-out-pocket-family"]')
  const cta = fixture.locator('.pokemon-pocket__cta')
  await fixture.waitFor()
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-before.png`) })
  const before = await cta.evaluate(node => {
    const section = node.closest('[data-schema-section-id]'), style = getComputedStyle(node), r = section.getBoundingClientRect(), copy = section.querySelector('.pokemon-pocket__copy').getBoundingClientRect()
    const matchedFontRules=[]; const visit=rules=>{ for(const rule of rules||[]){ if(rule.cssRules) visit(rule.cssRules); else if(rule.selectorText && rule.style?.fontSize && node.matches(rule.selectorText)) matchedFontRules.push({selector:rule.selectorText,fontSize:rule.style.fontSize,important:rule.style.getPropertyPriority('font-size')}) } }; for(const sheet of document.styleSheets){ try{ visit(sheet.cssRules) }catch{} }
    const ancestorZooms=[]; for(let el=node;el;el=el.parentElement){ const zoom=getComputedStyle(el).zoom; if(zoom && zoom!=='1') ancestorZooms.push({tag:el.tagName,className:el.className,zoom}) }
    return { url: location.href, tagName: node.tagName, type: node.getAttribute('type'), href: node.getAttribute('href'), pressed: node.getAttribute('aria-pressed'), fontFamily: style.fontFamily, fontSize: style.fontSize, fontStyle: style.fontStyle, fontWeight: style.fontWeight, color: style.color, backgroundColor: style.backgroundColor, matchedFontRules, ancestorZooms, section: { width: r.width, height: r.height }, copy: { x: copy.x-r.x, y: copy.y-r.y, width: copy.width, height: copy.height }, overflow: section.scrollWidth > section.clientWidth }
  })
  await cta.hover()
  const hover = await cta.evaluate(node => { const s=getComputedStyle(node); return { color:s.color, fontFamily:s.fontFamily, fontSize:s.fontSize, fontStyle:s.fontStyle, fontWeight:s.fontWeight } })
  await cta.click()
  const afterClick = await page.evaluate(() => { const section=document.querySelector('[data-schema-section-id="held-out-pocket-family"]'), cta=section.querySelector('.pokemon-pocket__cta'); return { url:location.href, fixtureVisible:!!section, pressed:cta.getAttribute('aria-pressed'), liveText:section.querySelector('[aria-live="polite"]')?.textContent.trim() } })
  await fixture.screenshot({ path: path.join(captureDir, `held-out-${surface.id}-after-local-review.png`) })
  await page.reload({ waitUntil: 'networkidle' })
  const afterReload = await page.evaluate(() => ({ url:location.href, fixtureVisible:!!document.querySelector('[data-schema-section-id="held-out-pocket-family"]') }))
  results.push({ surface, before, hover, afterClick, afterReload, console:{ errors, warnings } })
  await page.close()
}
await browser.close()

const typography = value => value.fontFamily.includes('PT Sans Official') && value.fontSize === '20px' && value.fontStyle === 'italic' && value.fontWeight === '700'
const checks = {
  frozenCtaTypography: results.every(r => typography(r.before) && typography(r.hover)),
  approvedCtaStates: results.every(r => r.before.color === 'rgb(0, 0, 0)' && r.before.backgroundColor === 'rgb(255, 255, 255)' && r.hover.color === 'rgb(226, 186, 101)'),
  semanticLocalAction: results.every(r => r.before.tagName === 'BUTTON' && r.before.type === 'button' && r.before.href === null),
  localStateAndLiveRegion: results.every(r => r.before.pressed === 'false' && r.afterClick.pressed === 'true' && r.afterClick.liveText.includes('route remains open')),
  routeSafeAcrossClickAndReload: results.every(r => r.before.url === r.afterClick.url && r.before.url === r.afterReload.url && r.before.url.endsWith(route) && r.afterClick.fixtureVisible && r.afterReload.fixtureVisible),
  geometryPreserved: results[0].before.section.width === 1440 && Math.abs(results[0].before.section.height-476.195)<1 && results[0].before.copy.x === 0 && Math.abs(results[0].before.copy.y-59.85)<1 && results[1].before.section.width === 390 && Math.abs(results[1].before.section.height-743.023)<1 && Math.abs(results[1].before.copy.y-334.23)<1,
  noOverflow: results.every(r => !r.before.overflow),
  consoleClean: results.every(r => !r.console.errors.length && !r.console.warnings.length),
}
const output = { schema:'brand-browser-probes/v1', brand:'pokemon-tcg-official', attempt:'10-demo-revision5', scope:'held-out Pocket CTA frozen typography, approved states, and route-safe local behavior', route, results, checks, implementationChecksPass:Object.values(checks).every(Boolean), visualVerdict:'not-assigned-by-implementation-agent' }
fs.writeFileSync(path.join(outputDir, 'browser-probes.json'), `${JSON.stringify(output, null, 2)}\n`)
if (!output.implementationChecksPass) process.exitCode = 1
