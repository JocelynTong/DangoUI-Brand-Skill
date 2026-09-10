import fs from 'node:fs'

const files = {
  viewer: 'card-plugin2.0/frontend/src/components/CardViewer.vue',
  plaza: 'card-plugin2.0/frontend/src/pages/plaza/index.vue',
  viewerCss: 'card-plugin2.0/frontend/src/components/CardViewer.scss',
  theme: 'card-plugin2.0/frontend/src/styles/onepiece-cardgame-heldout-theme.scss'
}
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]))
const checks = {
  hostCardBackPreserved: text.viewer.includes('zoomimg zoomimg-back') && text.plaza.includes('image class="pitch-card-back"'),
  noSyntheticBrandCardBack: !text.viewer.includes('brand-card-back') && !text.plaza.includes('brand-card-back') && !text.theme.includes('brand-card-back'),
  noUnprovenDeckMark: !text.viewer.includes('brand-card-back__mark') && !text.plaza.includes('brand-card-back__mark'),
  motionVariablesConsumed: ['--host-motion-zoom-in', '--host-motion-zoom-out', '--host-motion-flip-duration'].every(token => text.viewerCss.includes(token)),
  motionNotOverriddenByOnePiece: !/--host-motion-(?:hero|overlay|flip|zoom)/.test(text.theme),
  autoFlipContractConsumed: text.plaza.includes('--host-motion-hero-cycle'),
  noLiteralAutoFlipInterval: !/setInterval\(toggleHeroFlip,\s*4200\)/.test(text.plaza)
}
const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name)
console.log(JSON.stringify({ schema: 'themed-showcase-gate/v1', checks, status: failed.length ? 'FAIL' : 'PASS' }, null, 2))
if (failed.length) process.exit(1)
