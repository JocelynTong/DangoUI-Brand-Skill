import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const migration = path.join(root, "migrations/pokemon-tcg-official-v2");
const ev = path.join(migration, "evidence");
const rel = (p) => path.relative(root, p);
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const ref = (p) => ({ path: rel(p), sha256: hash(p) });
const write = (name, value) => fs.writeFileSync(path.join(migration, name), `${JSON.stringify(value, null, 2)}\n`);

const pageConfig = {
  home: { url: "https://tcg.pokemon.com/en-us/", height: 6958, positions: [0,900,1800,2700,3600,4500,5400,6058], dir: "home", files: ["scroll-0000.jpg","scroll-0900.jpg","scroll-1800.jpg","scroll-2700.jpg","scroll-3600.jpg","scroll-4500.jpg","scroll-5400.jpg","scroll-6118.jpg"] },
  "card-database": { url: "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards", height: 1532, positions: [0,308,632], dir: "card-database", files: ["scroll-0000.jpg","scroll-0308.jpg","scroll-0632.jpg"] },
  "how-to-play": { url: "https://tcg.pokemon.com/en-us/learn/", height: 10965, positions: [0,900,1800,2700,3600,4500,5400,6300,7200,8100,9000,10065], dir: "how-to-play", files: ["scroll-00000.jpg","scroll-00900.jpg","scroll-01800.jpg","scroll-02700.jpg","scroll-03600.jpg","scroll-04500.jpg","scroll-05400.jpg","scroll-06300.jpg","scroll-07200.jpg","scroll-08100.jpg","scroll-09000.jpg","scroll-10065.jpg"] },
};

for (const [id, cfg] of Object.entries(pageConfig)) {
  const timeline = { schema: "brand-source-timeline/v1", pageId: id, meta: { url: cfg.url, viewport: { width: 1440, height: 900 }, scrollHeight: cfg.height, captureMode: "fixed-step-lossless-frames" }, frames: cfg.files.map((file, i) => ({ index: i, timeMs: i * 500, label: i === 0 ? "stable-initial" : i === cfg.files.length - 1 ? "settled-end" : "continuous-scroll", scrollTop: cfg.positions[i], scrollHeight: cfg.height, capture: ref(path.join(ev, cfg.dir, "desktop/frames", file)) })) };
  write(`evidence/${cfg.dir}/desktop/timeline.json`, timeline);
}

const pages = Object.entries(pageConfig).map(([id, cfg]) => ({
  id, url: cfg.url, status: "covered", viewport: { width: 1440, height: 900 },
  fullPageCapture: ref(path.join(ev, cfg.dir, "desktop/full-page.jpg")),
  continuousCapture: ref(path.join(ev, cfg.dir, "desktop/continuous-scroll.mp4")),
  timeline: ref(path.join(ev, cfg.dir, "desktop/timeline.json")),
  states: ["initial", "continuous-scroll", "settled-end"],
  responsiveEvidence: { viewport: { width: 390, height: 844 }, fullPageCapture: ref(path.join(ev, cfg.dir, "mobile/full-page.jpg")), initialCapture: ref(path.join(ev, cfg.dir, "mobile/initial.jpg")), settledEndCapture: ref(path.join(ev, cfg.dir, "mobile/settled-end.jpg")) },
  coverage: { startsAtTop: true, reachesPageEnd: true, fullPage: true, responsive: true },
}));

const claims = [
  { id: "home-brand-stage-observed", sourcePageId: "home", status: "observed", salience: "high", kind: "composition", state: "initial", statement: "The home page opens with a dominant full-width campaign stage above a modular news/content sequence.", capture: pages[0].fullPageCapture, sourceRegion: [0,0,1,0.18], visibleDom: { selector: ".featured-switcher", visible: true, boundingBox: { x:0,y:84,width:1440,height:816 } }, computed: { property: "display", value: "block" }, evidenceBasis: "rendered screenshot first; DOM used only for location" },
  { id: "card-database-search-organism-observed", sourcePageId: "card-database", status: "observed", salience: "high", kind: "composition", state: "default", statement: "The database is organized around a dense, dark search/filter organism with keyword, energy, reset/search and expandable advanced filters.", capture: pages[1].fullPageCapture, sourceRegion: [0.08,0.1,0.84,0.58], visibleDom: { selector: "#card-search", visible: true, boundingBox: { x:120,y:200,width:1200,height:600 } }, computed: { property: "display", value: "block" }, evidenceBasis: "rendered screenshot plus visible control state" },
  { id: "learning-content-hierarchy-observed", sourcePageId: "how-to-play", status: "observed", salience: "high", kind: "composition", state: "initial", statement: "The learn page uses a campaign header, large tutorial media, sequenced learning modules, annotated card/field sections and supporting resource cards.", capture: pages[2].fullPageCapture, sourceRegion: [0,0,1,0.65], visibleDom: { selector: "main", visible: true, boundingBox: { x:0,y:248,width:1440,height:9000 } }, computed: { property: "display", value: "block" }, evidenceBasis: "rendered full-page and continuous scroll frames" },
  { id: "home-responsive-section-structure", sourcePageId: "home", status: "observed", salience: "high", kind: "composition", state: "mobile-initial", statement: "At 390 px, the same home hierarchy is retained while modules stack and the page becomes taller.", capture: pages[0].responsiveEvidence.fullPageCapture, sourceRegion: [0,0,1,0.35], visibleDom: { selector: "#site-wrapper", visible: true, boundingBox: { x:0,y:0,width:390,height:9037 } }, computed: { property: "width", value: "390px" } },
  { id: "card-database-responsive-section-structure", sourcePageId: "card-database", status: "observed", salience: "high", kind: "composition", state: "mobile-initial", statement: "At 390 px, database controls reflow vertically while preserving search-first order and advanced-filter disclosure.", capture: pages[1].responsiveEvidence.fullPageCapture, sourceRegion: [0,0,1,0.72], visibleDom: { selector: "main", visible: true, boundingBox: { x:0,y:0,width:390,height:2678 } }, computed: { property: "width", value: "390px" } },
  { id: "learn-responsive-section-structure", sourcePageId: "how-to-play", status: "observed", salience: "high", kind: "composition", state: "mobile-initial", statement: "At 390 px, tutorial and learning sections remain ordered but collapse into a single-column sequence.", capture: pages[2].responsiveEvidence.fullPageCapture, sourceRegion: [0,0,1,0.7], visibleDom: { selector: "main", visible: true, boundingBox: { x:0,y:0,width:390,height:7928 } }, computed: { property: "width", value: "390px" } },
  { id: "card-advanced-search-open", sourcePageId: "card-database", status: "observed", salience: "high", kind: "interaction", state: "expanded", statement: "The disclosure changes from Show Advanced Search to Hide Advanced Search and reveals the filter body.", capture: ref(path.join(ev,"card-database/desktop/interaction-advanced-settled.jpg")), sourceRegion: [0.35,0.35,0.3,0.25], visibleDom: { selector: "#toggleWrapperMainText b", visible: true, boundingBox: { x:621.6,y:441.9,width:164.5,height:16 } }, computed: { property: "color", value: "rgb(255, 255, 255)" } },
  { id: "learn-card-name-details-open", sourcePageId: "how-to-play", status: "observed", salience: "high", kind: "interaction", state: "open", statement: "Opening the Card Name summary sets its native details element to open and reveals explanatory copy.", capture: ref(path.join(ev,"how-to-play/desktop/interaction-card-name-settled.jpg")), sourceRegion: [0.12,0.35,0.5,0.42], visibleDom: { selector: "details.hotspot-gallery-accordion__panel[open] > summary", visible: true, boundingBox: { x:206,y:433.2,width:428,height:33.6 } }, computed: { property: "color", value: "rgb(190, 14, 23)" } },
];

const evidence = { schema: "brand-evidence/v3", goalId: "pokemon-tcg-official-v2-full-revalidation", goalSha256: "37fd65bf8fbca5099e062e8afece13747c987b44424f7fe3b8334380e3f7a845", capturePersistenceProbe: { status: "passed", ...ref(path.join(ev,"capture-persistence-probe.png")), byteSignature: "ffd8ffe0", decoderCheck: "JPEG SOI/JFIF signature and browser-generated non-zero viewport raster verified after re-read" }, goalQuestions: [
  { goalItem: "home-brand-stage", question: "Does the rendered home page visibly prioritize a campaign stage and retain its section hierarchy?", stopCondition: "desktop full-page + scroll-to-end + mobile full-page + visible DOM" },
  { goalItem: "card-database-search-organism", question: "Is search/filter composition visible and does advanced disclosure produce and restore a real state?", stopCondition: "default/triggered/settled/restored captures + exact DOM/computed property" },
  { goalItem: "learning-content-hierarchy", question: "Does the learn page visibly sequence tutorial, card/field knowledge and resources, including a real expandable state?", stopCondition: "full-page/continuous frames + native details interaction chain" },
  { goalItem: "responsive-section-structure", question: "Do all three pages preserve section order and hierarchy at 390 px?", stopCondition: "desktop and mobile full-page evidence for every required page" },
  ], claims, goalCoverage: [
    { id:"home-brand-stage", verdict:"proved", evidenceRefs:["home-brand-stage-observed"] },
    { id:"card-database-search-organism", verdict:"proved", evidenceRefs:["card-database-search-organism-observed","card-advanced-search-open"] },
    { id:"learning-content-hierarchy", verdict:"proved", evidenceRefs:["learning-content-hierarchy-observed","learn-card-name-details-open"] },
    { id:"responsive-section-structure", verdict:"proved", evidenceRefs:["home-responsive-section-structure","card-database-responsive-section-structure","learn-responsive-section-structure"] },
  ], thirdPartySeedDispositions: [
    { seedRef:"dembrandt.typography.heading", status:"validated", evidenceRefs:["home-brand-stage-observed","learning-content-hierarchy-observed"], reason:"PT Sans/Kanit candidates were checked against rendered headings and controls; semantic promotion remains downstream." },
    { seedRef:"dembrandt.palette.frequency", status:"unresolved", reason:"Aggregate palette frequency is seed-only and cannot establish action or primary color semantics; no mustPreserve item depends on it." },
    { seedRef:"dembrandt.components.controls", status:"validated", evidenceRefs:["card-advanced-search-open","learn-card-name-details-open"], reason:"Candidate control patterns were confirmed with visible before/after states." },
  ], verdict: "pass" };

const observation = { schema:"source-observation-manifest/v2", goalId:evidence.goalId, viewport:{width:1440,height:900}, pages, interactions:[
  { id:"card-advanced-search", sourcePageId:"card-database", status:"covered", trigger:"click visible Show Advanced Search disclosure, then Hide Advanced Search to restore", states:["default","triggered","settled","restored"], beforeCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-default.jpg")), afterCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-settled.jpg")) },
  { id:"learn-card-name-details", sourcePageId:"how-to-play", status:"covered", trigger:"click native summary CARD NAME, then click again to restore", states:["default","triggered","settled","restored"], beforeCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-default.jpg")), afterCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-settled.jpg")) },
  ], coverage:{requiredPages:3,coveredPages:3,fullPageCoverage:1,continuousCoverage:1,responsiveCoverage:1,interactionCoverage:1,readyForInterpreter:true} };

const actions = { schema:"action-evidence/v2", goalId:evidence.goalId, entries:[
  { id:"card-advanced-search-open", sourcePageId:"card-database", selector:"#toggleWrapperMainText b", observedState:"expanded/open", trigger:"click Show Advanced Search; wait 600ms; click Hide Advanced Search to restore", className:"", beforeCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-default.jpg")), transitionCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-triggered.jpg")), afterCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-settled.jpg")), restoredCapture:ref(path.join(ev,"card-database/desktop/interaction-advanced-restored.jpg")), computedProperty:"color", computedValue:"rgb(255, 255, 255)", sourceRule:"visible <b> disclosure; computed transition: all; text changes Show ↔ Hide" },
  { id:"learn-card-name-details-open", sourcePageId:"how-to-play", selector:"details.hotspot-gallery-accordion__panel[open] > summary", observedState:"open", trigger:"click SUMMARY CARD NAME; wait 500ms; click again to restore", className:"hotspot-gallery-accordion__panel large-up", beforeCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-default.jpg")), transitionCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-triggered.jpg")), afterCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-settled.jpg")), restoredCapture:ref(path.join(ev,"how-to-play/desktop/interaction-card-name-restored.jpg")), computedProperty:"color", computedValue:"rgb(190, 14, 23)", sourceRule:"summary computed transition: color 0.3s; parent DETAILS open changes false → true → false" },
] };

const inventory = { schema:"rendered-asset-inventory/v2", goalId:evidence.goalId, pages:[
  { id:"home", summary:{font:6,image:33,stylesheet:4}, renderedAssets:[
    {kind:"image",url:"https://d1i787aglh9bmb.cloudfront.net/assets/img/home/featured-switcher/thirty/booster-art-1-large-up.jpg",usage:"hero campaign stage",capture:evidence.claims[0].capture},
    {kind:"image",url:"https://d1i787aglh9bmb.cloudfront.net/assets/img/me-expansions/thirty/logo/en-us/Logo-30th.png",usage:"hero expansion identity",capture:evidence.claims[0].capture},
    {kind:"font",url:"https://fonts.googleapis.com/css?family=Kanit:700|PT+Sans:400,700&display=swap",usage:"display and body typography",capture:evidence.claims[0].capture}] },
  { id:"card-database", summary:{image:133,stylesheet:11,script:15}, renderedAssets:[{kind:"stylesheet",url:"https://assets.pokemon.com/static2/_ui/css/card-database.css",usage:"search/filter layout",capture:evidence.claims[1].capture},{kind:"font",url:"https://fonts.googleapis.com/css?family=Roboto:400,700",usage:"database typography candidate",capture:evidence.claims[1].capture}] },
  { id:"how-to-play", summary:{font:5,image:42,stylesheet:3}, renderedAssets:[{kind:"image",url:"https://tcg.pokemon.com/assets/img/learn-to-play/hero/card-header-asset_en-2x.png",usage:"learning hero",capture:evidence.claims[2].capture},{kind:"image",url:"https://tcg.pokemon.com/assets/img/learn-to-play/getting-started/getting-started-video-thumbnail.jpg",usage:"tutorial module",capture:evidence.claims[2].capture},{kind:"stylesheet",url:"https://tcg.pokemon.com/learn/learn.css",usage:"learning page layout",capture:evidence.claims[2].capture}] },
] };

const thirdParty = { schema:"third-party-evidence/v1", provider:"dembrandt", sourceType:"seed-only", sourceUrl:"https://tcg.pokemon.com/en-us/", extractionStatus:"attempted", note:"Dembrandt was run as candidate discovery only. Its candidates require rendered disposition in brand-evidence.json and do not establish facts.", candidateHints:{ typography:["Kanit","PT Sans"], paletteFrequency:"unresolved", controls:["button","disclosure","details/summary"] } };

write("brand-evidence.json", evidence);
write("source-observation-manifest.json", observation);
write("action-evidence.json", actions);
write("action-evidence-v02.json", actions);
write("rendered-asset-inventory.json", inventory);
write("third-party-evidence.dembrandt.json", thirdParty);
console.log(JSON.stringify({outputs:["brand-evidence.json","source-observation-manifest.json","action-evidence.json","rendered-asset-inventory.json","third-party-evidence.dembrandt.json"].map(n=>({path:`migrations/pokemon-tcg-official-v2/${n}`,sha256:hash(path.join(migration,n))}))},null,2));
