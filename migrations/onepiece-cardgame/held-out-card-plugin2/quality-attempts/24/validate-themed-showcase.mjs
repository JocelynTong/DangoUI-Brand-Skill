import fs from 'node:fs'

const files = {
  viewer: 'card-plugin2.0/frontend/src/components/CardViewer.vue',
  plaza: 'card-plugin2.0/frontend/src/pages/plaza/index.vue',
  viewerCss: 'card-plugin2.0/frontend/src/components/CardViewer.scss',
  theme: 'card-plugin2.0/frontend/src/styles/onepiece-cardgame-heldout-theme.scss'
}
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]))
const checks = {
  originalZoomSemanticsRestored: text.viewer.includes('<view class="zoomstage" @tap.stop="noop">') && !text.viewer.includes('翻转卡牌'),
  noCardBackInZoom: !text.viewer.includes('zoomimg-back') && !text.viewer.includes('pitchCardBack'),
  noHeroFlipControl: !text.plaza.includes('heroFlipped') && !text.plaza.includes('toggleHeroFlip') && !text.plaza.includes('pitch-hero-back'),
  noSyntheticBrandCardBack: !text.viewer.includes('brand-card-back') && !text.plaza.includes('brand-card-back') && !text.theme.includes('brand-card-back'),
  noUnprovenDeckMark: !text.viewer.includes('brand-card-back__mark') && !text.plaza.includes('brand-card-back__mark'),
  noFlipCssOrMotionContract: !/zoomflip|zoomback|zoomFrontPass|zoomBackPass|zoomFlipSettle|--host-motion-(?:hero|flip|zoom)/.test(`${text.viewerCss}\n${text.theme}`),
  simpleZoomOnly: /\.zoomstage\s*\{[^}]*display:\s*flex/s.test(text.viewerCss)
}
const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name)
console.log(JSON.stringify({ schema: 'themed-showcase-gate/v1', checks, status: failed.length ? 'FAIL' : 'PASS' }, null, 2))
if (failed.length) process.exit(1)
