import fs from 'node:fs'

const files = {
  viewer: 'card-plugin2.0/frontend/src/components/CardViewer.vue',
  plaza: 'card-plugin2.0/frontend/src/pages/plaza/index.vue',
  viewerCss: 'card-plugin2.0/frontend/src/components/CardViewer.scss',
  theme: 'card-plugin2.0/frontend/src/styles/onepiece-cardgame-heldout-theme.scss'
}
const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]))
const checks = {
  sharedCardBackSurface: text.viewer.includes('brand-card-back') && text.plaza.includes('brand-card-back'),
  pokemonAssetHiddenByHostTheme: /brand-card-back__asset\s*\{[^}]*display:\s*none/s.test(text.theme),
  hostCardBackMark: /brand-card-back__mark\s*\{[^}]*display:\s*flex/s.test(text.theme),
  motionVariablesConsumed: ['--host-motion-zoom-in', '--host-motion-zoom-out', '--host-motion-flip-duration'].every(token => text.viewerCss.includes(token)),
  autoFlipThemeControlled: text.plaza.includes('--host-motion-hero-cycle') && text.theme.includes('--host-motion-hero-cycle: 0ms'),
  noLiteralAutoFlipInterval: !/setInterval\(toggleHeroFlip,\s*4200\)/.test(text.plaza)
}
const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name)
console.log(JSON.stringify({ schema: 'themed-showcase-gate/v1', checks, status: failed.length ? 'FAIL' : 'PASS' }, null, 2))
if (failed.length) process.exit(1)
