import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const migration = path.join(root, 'migrations/hpma-v2');
const captureRoot = path.join(root, 'output/extractor-benchmark/hpma-v2/source-captures');
const rel = p => path.relative(root, p);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const cap = p => ({ path: rel(p), sha256: hash(p) });
const pageFile = (id, name) => path.join(captureRoot, id, name);
const capturedAt = new Date().toISOString();
const sourceUrl = 'https://www.harrypottermagicawakened.com/cn/index.html';

const homeCapture = cap(pageFile('home', 'full-page.png'));
const cardsCapture = cap(pageFile('cards-media', 'full-page.png'));
const claims = [
  {
    id: 'home-dark-cinematic-stage', sourcePageId: 'home', status: 'observed', kind: 'composition', salience: 'high', state: 'initial',
    summary: 'The initial viewport is a full-bleed moonlit lake/castle scene with a large pale-gold title, a framed download cluster, and a vertical stack of ornate outlined actions.',
    capture: homeCapture, sourceRegion: [0, 0, 1, 1],
    visibleDom: { selector: '.wrap', visible: true, boundingBox: { x: 0, y: 0, width: 1280, height: 750 }, state: 'nav1 on' },
    computed: { property: 'font-family', value: '"Microsoft YaHei"' }, assetRefs: ['asset-home-background', 'asset-home-action-frame']
  },
  {
    id: 'home-active-nav-muted-versus-gold', sourcePageId: 'home', status: 'observed', kind: 'color', salience: 'high', state: 'initial',
    summary: 'The selected home navigation label is muted light gray while unselected navigation labels are warm gold; selection is also marked by an ornamental underline.',
    capture: homeCapture, sourceRegion: [0.005, 0.01, 0.96, 0.08],
    visibleDom: { selector: '.nav_link.nav1.on', visible: true, boundingBox: { x: 8, y: 23.5, width: 140.4, height: 37 }, state: 'on' },
    computed: { property: 'color', value: 'rgb(218, 218, 218)' }, comparison: { selector: '.nav_link.nav2', property: 'color', value: 'rgb(194, 166, 115)' }
  },
  {
    id: 'cards-media-illustrated-book-stage', sourcePageId: 'cards-media', status: 'observed', kind: 'composition', salience: 'high', state: 'nav4 on',
    summary: 'The spells/companions surface uses a full-viewport character illustration with a sepia storybook panel and gold ornamental line paths instead of generic rounded cards.',
    capture: cardsCapture, sourceRegion: [0.045, 0.08, 0.91, 0.86],
    visibleDom: { selector: '.media', visible: true, boundingBox: { x: 58.33, y: 957.67, width: 1163.33, height: 466.67 }, state: 'nav4 on; internal transformed stage' },
    assetRefs: ['asset-cards-stage', 'asset-cards-book-panel']
  },
  {
    id: 'cards-media-nav-gold', sourcePageId: 'cards-media', status: 'observed', kind: 'color', salience: 'high', state: 'nav4 on',
    summary: 'The selected spells/companions navigation item computes light gray while neighboring inactive items remain warm gold.',
    capture: cardsCapture, sourceRegion: [0.005, 0.01, 0.96, 0.08],
    visibleDom: { selector: '.nav_link.nav4.on', visible: true, boundingBox: { x: 477.21, y: 23.5, width: 140.4, height: 37 }, state: 'on' },
    computed: { property: 'color', value: 'rgb(218, 218, 218)' }, comparison: { selector: '.nav_link.nav2', property: 'color', value: 'rgb(194, 166, 115)' }
  }
];

const evidence = {
  schema: 'brand-evidence/v4', brand: 'hpma-v2', goalId: 'hpma-full-revalidation-v2', sourceUrl, capturedAt, status: 'needs-evidence',
  evidenceQuestions: [
    { id: 'q-parchment-dark-stage', question: 'Does HOME visibly combine a dark cinematic stage with parchment/gold information and action surfaces?', stopCondition: 'Full viewport capture plus visible DOM, computed role values and asset identities.' },
    { id: 'q-ornate-news-frame', question: 'Does the reachable NEWS state visibly use the same ornate frame grammar as cards/media?', stopCondition: 'Distinct news-state screenshot, non-zero visible DOM region, computed properties and interaction trace.' },
    { id: 'q-ornate-cards-frame', question: 'Does CARDS/MEDIA visibly use authored book/frame geometry rather than generic rounded cards?', stopCondition: 'Distinct state capture plus visible DOM and source asset identity.' },
    { id: 'q-action-media-semantics', question: 'Across HOME, NEWS and CARDS/MEDIA, are brown/gold framed actions observably distinct from magical media surfaces in default, triggered, settled and restored states?', stopCondition: 'Page-scoped before/transition/after/restored captures with changed computed properties.' }
  ],
  claims,
  notObserved: [
    { id: 'news-distinct-state', sourcePageId: 'news', status: 'unavailable', reason: 'The attempted .news_btn and news category triggers did not produce a distinct visible news panel in the automated capture; .newsBig_box retained width 0 and x=1280. The resulting screenshot is identical in structure to HOME and is not promoted as NEWS evidence.' },
    { id: 'news-category-change', sourcePageId: 'news', status: 'not-observed', reason: 'Forced click on .nav_tit3 produced no computed color/backgroundColor change and no verifiable visible state change; captures are retained only as negative evidence.' }
  ],
  thirdPartySeedDispositions: [
    { seedRef: 'dembrandt.colors.semantic.primary', status: 'validated', evidenceRefs: ['home-active-nav-muted-versus-gold', 'cards-media-nav-gold'] },
    { seedRef: 'dembrandt.colors.semantic.background', status: 'rejected', reason: 'The extractor reports #FCFBF9, but both visible goal-critical stages are dark full-bleed raster compositions; the light aggregate does not describe the observed main surface.' },
    { seedRef: 'dembrandt.colors.semantic.text', status: 'rejected', reason: 'The extractor reports black as semantic text, while the observed navigation and headline system is pale gray/warm gold over dark imagery.' },
    { seedRef: 'dembrandt.primaryActionFillSeed.#610000', status: 'out-of-scope', reason: 'This seed comes from the footer guardianship link and does not prove a goal-critical primary action role.' },
    { seedRef: 'dembrandt.borderRadius.16px', status: 'out-of-scope', reason: 'No goal-critical high-salience visible section was shown to rely on this radius.' },
    { seedRef: 'dembrandt.borderRadius.100percent', status: 'out-of-scope', reason: 'Circular minor controls do not establish the ornate frame grammar required by the frozen goal.' }
  ],
  goalCoverage: [
    { goalItemId: 'parchment-dark-stage', verdict: 'proved', evidenceRefs: ['home-dark-cinematic-stage', 'home-active-nav-muted-versus-gold'] },
    { goalItemId: 'ornate-frame-grammar', verdict: 'unresolved', evidenceRefs: ['cards-media-illustrated-book-stage'], reason: 'Cards/media is observed, but distinct NEWS evidence is unavailable.' },
    { goalItemId: 'brown-action-versus-magic-media', verdict: 'unresolved', evidenceRefs: ['home-dark-cinematic-stage', 'cards-media-illustrated-book-stage'], reason: 'Required cross-page interaction semantics cannot be proved without a visible NEWS state and an interaction with a computed visual change.' }
  ]
};

const pages = ['home','news','cards-media'].map(id => {
  if (id === 'news') return { id, url: sourceUrl, status: 'unavailable', unavailableReason: 'No distinct visible NEWS state could be reproduced: .newsBig_box remained zero-width/off-canvas after the available news triggers; retained captures show HOME and are not treated as NEWS proof.' };
  return {
    id, url: sourceUrl, status: 'covered', navigationModel: 'fixed-height, internally transformed presentation; document scroll range is 30px',
    requiredStates: { initial: true, continuousScroll: true, settledEnd: true, restored: false },
    fullPageCapture: cap(pageFile(id,'full-page.png')), continuousCapture: cap(pageFile(id,'continuous.gif')), timeline: cap(pageFile(id,'timeline.json')),
    coverage: { initial: true, continuousScroll: true, settledEnd: true, restored: false }
  };
});
const observation = { schema: 'source-observation-manifest/v1', brand: 'hpma-v2', goalId: 'hpma-full-revalidation-v2', capturedAt, viewport: { width: 1280, height: 720 }, pages, interactions: [{ id: 'news-category-trigger', status: 'unavailable', unavailableReason: 'No visible or computed style change was observed after the reproducible forced click; negative before/transition/after/restored captures retained.' }], coverage: { readyForInterpreter: false, requiredPageIds: ['home','news','cards-media'], covered: 2, unavailable: 1, notes: 'NEWS and required restored interaction evidence remain unavailable; Interpreter dispatch is blocked.' } };

const assets = {
  schema: 'rendered-asset-inventory/v1', brand: 'hpma-v2', sourceUrl, capturedAt,
  assets: [
    { id: 'asset-home-background', status: 'observed', role: 'full-viewport cinematic background', sourceUrl: 'official page runtime asset; exact URL requires a browser network export not available in this run', captureRef: 'home-dark-cinematic-stage', availability: 'rendered-observed-source-url-unresolved' },
    { id: 'asset-home-action-frame', status: 'observed', role: 'ornate action and download frame graphics', sourceUrl: 'official page runtime asset; exact URL unresolved', captureRef: 'home-dark-cinematic-stage', availability: 'rendered-observed-source-url-unresolved' },
    { id: 'asset-cards-stage', status: 'observed', role: 'full-viewport character illustration', sourceUrl: 'official page runtime asset; exact URL unresolved', captureRef: 'cards-media-illustrated-book-stage', availability: 'rendered-observed-source-url-unresolved' },
    { id: 'asset-cards-book-panel', status: 'observed', role: 'sepia book/profile information panel', sourceUrl: 'official page runtime asset; exact URL unresolved', captureRef: 'cards-media-illustrated-book-stage', availability: 'rendered-observed-source-url-unresolved' }
  ],
  limitations: ['Loaded pixels were observed, but source asset URLs and binary hashes were not independently exported; these entries cannot authorize runtime reuse.']
};

const actions = { schema: 'action-evidence/v2', brand: 'hpma-v2', goalId: 'hpma-full-revalidation-v2', entries: [{ id: 'news-category-trigger-negative', selector: '.nav_tit3', observedState: 'triggered-no-visible-change', trigger: 'click .news_btn, wait 700ms, force-click .nav_tit3, wait through 100ms transition and 800ms settled intervals', beforeCapture: rel(path.join(captureRoot,'interaction-news-tab-before.png')), transitionCapture: rel(path.join(captureRoot,'interaction-news-tab-transition.png')), afterCapture: rel(path.join(captureRoot,'interaction-news-tab-after.png')), restoredCapture: rel(path.join(captureRoot,'interaction-news-tab-restored.png')), computedProperty: 'color', computedValue: 'rgb(255, 255, 255)', beforeComputedValue: 'rgb(255, 255, 255)', sourceRule: 'current rendered computed style only; no changed source rule was established', verdict: 'not-observed', note: 'No pixel/computed delta was verified; this entry is negative evidence and blocks semantic promotion.' }] };

const sections = { schema: 'brand-section-fidelity-manifest/v1', brand: 'hpma-v2', goalId: 'hpma-full-revalidation-v2', sections: [
  { id: 'home-dark-stage', sourcePageId: 'home', status: 'source-observed', sourceCapture: homeCapture, sourceRegion: [0,0,1,1], structureLayers: ['moonlit lake/castle full-bleed background','oversized pale-gold headline','framed QR/download cluster','outlined right action rail'], readingOrder: ['global nav/logo','headline','download cluster','right actions'], interactionStates: ['default'], assetEvidence: ['asset-home-background','asset-home-action-frame'], responsive: 'not-observed' },
  { id: 'news-ornate-frame', sourcePageId: 'news', status: 'unavailable', unavailableReason: 'Distinct news state could not be made visible; off-canvas DOM and unchanged captures are not accepted as evidence.' },
  { id: 'cards-illustrated-book', sourcePageId: 'cards-media', status: 'source-observed', sourceCapture: cardsCapture, sourceRegion: [0.045,0.08,0.91,0.86], structureLayers: ['full-viewport character illustration','gold ornamental path','sepia open-book panel','top navigation and download marker'], readingOrder: ['global nav/logo','section title','book/profile panel','illustrated character field'], interactionStates: ['default'], assetEvidence: ['asset-cards-stage','asset-cards-book-panel'], responsive: 'not-observed' }
] };

const questionMatrix = { schema: 'evidence-question-matrix/v1', brand: 'hpma-v2', goalId: 'hpma-full-revalidation-v2', questions: evidence.evidenceQuestions, pageCoverage: pages.map(p => ({ id: p.id, status: p.status, unavailableReason: p.unavailableReason || null })), stopDecision: 'needs-evidence', blockers: ['NEWS distinct rendered state unavailable','required interaction settled/restored visual delta unavailable','high-salience asset source URL/hash unresolved'] };

for (const [name, value] of Object.entries({ 'brand-evidence.json': evidence, 'source-observation-manifest.json': observation, 'rendered-asset-inventory.json': assets, 'action-evidence.json': actions, 'action-evidence-v02.json': actions, 'section-fidelity-manifest.json': sections, 'evidence-question-matrix.json': questionMatrix })) fs.writeFileSync(path.join(migration,name), JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({ ok: true, files: Object.keys({evidence,observation,assets,actions,sections,questionMatrix}) }, null, 2));
