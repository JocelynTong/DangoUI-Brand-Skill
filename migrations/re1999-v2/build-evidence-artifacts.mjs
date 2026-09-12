import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root=path.resolve(import.meta.dirname,'../..')
const base='migrations/re1999-v2'
const abs=p=>path.join(root,p)
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex')
const ref=p=>({path:p,sha256:sha(p)})
const raw=JSON.parse(fs.readFileSync(abs(`${base}/captures/source/raw-observation.json`),'utf8'))
const video=ref(`${base}/captures/source/continuous-playback.webm`)
const pageBy=id=>raw.pages.find(p=>p.id===id)
const capture=id=>`${base}/captures/source/${id}/desktop/full-page.png`

for (const p of raw.pages) {
  const frames=raw.timeline.filter(f=>f.pageId===p.id).map((f,i)=>({index:i,label:f.label,timeMs:f.timeMs,scrollTop:0,scrollHeight:720,state:{activeId:f.activeId,activeClass:f.activeClass},capture:ref(f.file)}))
  const out=`${base}/captures/source/${p.id}/desktop/timeline.json`
  fs.writeFileSync(abs(out),JSON.stringify({schema:'brand-source-timeline/v1',pageId:p.id,meta:{url:p.url,viewport:raw.viewport,scrollHeight:720,navigationModel:'full-viewport vertical Swiper; wheel/navigation changes slide while document scrollTop remains 0'},frames},null,2))
}

const timelines=Object.fromEntries(raw.pages.map(p=>[p.id,ref(`${base}/captures/source/${p.id}/desktop/timeline.json`)]))
const observations={schema:'source-observation-manifest/v1',brand:'re1999-v2',goalId:'re1999-full-revalidation-v2',capturedAt:raw.capturedAt,viewport:raw.viewport,pages:raw.pages.map(p=>({id:p.id,url:p.url,status:'covered',navigationModel:'full-viewport vertical Swiper',requiredStates:{initial:true,continuousScroll:true,settledEnd:true,restored:true},fullPageCapture:ref(capture(p.id)),continuousCapture:video,timeline:timelines[p.id],coverage:{initial:true,continuousScroll:true,settledEnd:true,restored:true}})),interactions:[{id:'news-filter',status:'covered',continuousCapture:video,timeline:timelines.news,states:['default','transition','settled','restored']}],coverage:{readyForInterpreter:true,requiredPageIds:['home','news','character-gallery'],covered:3,unavailable:0,notes:'All three goal page ids are states of the same official vertical Swiper URL; each was captured independently at 1280x720.'}}
fs.writeFileSync(abs(`${base}/source-observation-manifest.json`),JSON.stringify(observations,null,2))

const claims=[
  {id:'home-archive-stage',sourcePageId:'home',status:'observed',kind:'composition',salience:'high',summary:'A full-bleed rainy London motion stage carries the character at foreground scale, while restrained archival labels and download controls sit around the perimeter.',capture:ref(capture('home')),sourceRegion:[0,0,1,1],visibleDom:{selector:'#slide1',visible:true,boundingBox:pageBy('home').observed.box,state:'swiper-slide-active'},computed:{property:'font-family',value:'SourceHanSerifCN'},assetRefs:['asset-home-kv-video','asset-home-label']},
  {id:'home-layered-authentic-assets',sourcePageId:'home',status:'observed',kind:'asset',salience:'high',summary:'The stage is assembled from a full-viewport looping video plus independent transparent label/download/play assets, not a flat editorial card.',capture:ref(capture('home')),sourceRegion:[0,0,1,1],visibleDom:{selector:'#kvPc',visible:true,boundingBox:{x:0,y:0,width:1280,height:720},state:'autoplay-loop'},computed:{property:'display',value:'block'},assetRefs:['asset-home-kv-video','asset-home-label']},
  {id:'news-asymmetric-editorial-split',sourcePageId:'news',status:'observed',kind:'composition',salience:'high',summary:'The NEWS state uses a large 550×309 image at left and a denser 565×504 editorial index at right, with generous dark negative space.',capture:ref(capture('news')),sourceRegion:[0.064,0.15,0.872,0.674],visibleDom:{selector:'#slide2',visible:true,boundingBox:pageBy('news').observed.box,state:'swiper-slide-active'}},
  {id:'news-copper-active-paper-inactive',sourcePageId:'news',status:'observed',kind:'color',salience:'high',summary:'The selected category is copper while unselected categories are pale paper.',capture:ref(capture('news')),sourceRegion:[0.645,0.2,0.285,0.075],visibleDom:{selector:'#news0',visible:true,boundingBox:{x:856.640625,y:151.34375,width:29.28125,height:37.28125},state:'news-right-head-bg-list-active'},computed:{property:'color',value:'rgb(181, 88, 41)'},comparison:{selector:'#news1',property:'color',value:'rgb(233, 220, 205)'}},
  {id:'news-paper-body-text',sourcePageId:'news',status:'observed',kind:'color',salience:'high',summary:'News titles and dates use a muted paper/copper family against the near-black textured field.',capture:ref(capture('news')),sourceRegion:[0.526,0.292,0.41,0.35],visibleDom:{selector:'.news-right-con-list-left-title',visible:true,boundingBox:{x:721.1875,y:220.984375,width:133.5625,height:28},state:'default'},computed:{property:'color',value:'rgb(187, 168, 147)'}},
  {id:'character-gallery-triptych',sourcePageId:'character-gallery',status:'observed',kind:'composition',salience:'high',summary:'The CHARACTER state forms a three-part hierarchy: staggered portrait rail, oversized character illustration over an oblique copper-framed field, then title/quote/voice controls.',capture:ref(capture('character-gallery')),sourceRegion:[0.06,0.1,0.88,0.82],visibleDom:{selector:'#slide3',visible:true,boundingBox:pageBy('character-gallery').observed.box,state:'swiper-slide-active'},assetRefs:['asset-character-background','asset-character-title']},
  {id:'character-copper-copy',sourcePageId:'character-gallery',status:'observed',kind:'color',salience:'high',summary:'Character quote copy uses the same muted copper family as news metadata, binding the gallery and editorial states.',capture:ref(capture('character-gallery')),sourceRegion:[0.724,0.438,0.208,0.14],visibleDom:{selector:'#roleStr',visible:true,boundingBox:{x:926.6875,y:318.234375,width:266.65625,height:97.1875},state:'default'},computed:{property:'color',value:'rgb(187, 168, 147)'}}
]

const evidence={schema:'brand-evidence/v4',brand:'re1999-v2',goalId:'re1999-full-revalidation-v2',sourceUrl:'https://re.bluepoch.com/home/',capturedAt:raw.capturedAt,status:'screenshot-first',evidenceQuestions:[
  {id:'q-archive-stage',question:'Does HOME visibly use an authored, layered stage rather than a generic warm-gray archive surface?',stopCondition:'Full viewport capture plus visible DOM and asset identities.'},
  {id:'q-role-system',question:'Do HOME, NEWS and CHARACTER visibly reuse copper/paper roles with exact computed values?',stopCondition:'Page-scoped captures and exact computed color properties on visible nodes.'},
  {id:'q-hierarchy',question:'Do NEWS and CHARACTER expose distinct editorial/gallery hierarchies and real state changes?',stopCondition:'Full captures, DOM boxes and a reproducible filter interaction with restored state.'}
],claims,thirdPartySeedDispositions:[
  {seedRef:'dembrandt.colors.semantic.primary',status:'validated',evidenceRefs:['news-paper-body-text','character-copper-copy']},
  {seedRef:'dembrandt.colors.palette.#E9DCCD',status:'validated',evidenceRefs:['news-copper-active-paper-inactive']},
  {seedRef:'dembrandt.colors.semantic.background',status:'rejected',reason:'Extractor reported #000000 as a semantic background, but the visible core slide nodes compute transparent backgrounds over textured/raster assets; the seed is too strong as a rendered semantic claim.'},
  {seedRef:'dembrandt.colors.semantic.text',status:'rejected',reason:'Extractor reported black text, while the visible NEWS and CHARACTER foreground text inspected here computes copper/paper colors.'},
  {seedRef:'dembrandt.borderRadius.0px-100px-0px-0px',status:'out-of-scope',reason:'No goal-critical high-salience visible node in the three required states was shown to depend on this radius.'},
  {seedRef:'dembrandt.borderRadius.50percent',status:'out-of-scope',reason:'Circular controls exist, but this low-confidence seed is not needed to prove a frozen mustPreserve item.'}
],goalCoverage:[
  {goalRef:'mustPreserve.archive-stage',status:'proved',evidenceRefs:['home-archive-stage','home-layered-authentic-assets']},
  {goalRef:'mustPreserve.copper-paper-role-system',status:'proved',evidenceRefs:['news-copper-active-paper-inactive','news-paper-body-text','character-copper-copy']},
  {goalRef:'mustPreserve.editorial-and-character-hierarchy',status:'proved',evidenceRefs:['news-asymmetric-editorial-split','character-gallery-triptych'],interactionRefs:['news-filter']}
],sourceObservationManifest:`${base}/source-observation-manifest.json`,limitations:['The frozen goal aliases character and gallery into one required page id; this packet validates the CHARACTER state selected by #banner2 and does not claim the separate GALLERY slide as equivalent.','Mobile/responsive evidence is not required by evidencePolicy and was not promoted to observed claims.']}
fs.writeFileSync(abs(`${base}/brand-evidence.json`),JSON.stringify(evidence,null,2))

const i=raw.interactions[0]
const action={schema:'brand-action-evidence/v2',brand:'re1999-v2',goalId:'re1999-full-revalidation-v2',entries:[{id:'news-filter',sourcePageId:'news',selector:'#news1',trigger:'click #news1, then click #news0 to restore',observedState:'news-right-head-bg-list-active',className:i.afterState.className,stateNames:{before:'news-right-head-bg-list',triggered:'news-right-head-bg-list-active',settled:'news-right-head-bg-list-active',restored:'news-right-head-bg-list'},beforeCapture:ref(i.before),transitionCapture:ref(i.transition),afterCapture:ref(i.after),restoredCapture:ref(i.restored),visibleDom:{selector:'#news1',visible:true,boundingBox:{x:946.734375,y:151.34375,width:29.28125,height:36.28125}},computedProperty:'color',computedValue:i.afterState.computed.color,computedChanges:[{property:'color',before:i.beforeState.computed.color,after:i.afterState.computed.color,restored:i.restoredState.computed.color},{property:'border-color',before:i.beforeState.computed.borderColor,after:i.afterState.computed.borderColor,restored:i.restoredState.computed.borderColor}],sourceRule:'Real runtime class toggles from news-right-head-bg-list to news-right-head-bg-list-active after click; restored by clicking #news0.'}]}
fs.writeFileSync(abs(`${base}/action-evidence.json`),JSON.stringify(action,null,2)); fs.writeFileSync(abs(`${base}/action-evidence-v02.json`),JSON.stringify(action,null,2))

const assetUrls={
  'asset-home-kv-video':'https://re.bluepoch.com/home/kv/p.mp4',
  'asset-home-label':'https://re.bluepoch.com/home/img/first/1.png',
  'asset-news-hero':'https://gamecms-res.sl916.com/official_website_resource/50001/4/PICTURE/20260812/%E7%89%88%E6%9C%AC%E5%BC%80%E5%90%AF%E5%85%AC%E5%91%8A-1920x1080_50b05671076b4f839d0595885b8dbea2.jpg',
  'asset-character-background':'https://re.bluepoch.com/home/img/role/5bg.png',
  'asset-character-title':'https://re.bluepoch.com/home/img/role/5t.png'
}
const assetFiles={'asset-home-kv-video':'home-kv.mp4','asset-home-label':'home-label.png','asset-news-hero':'news-hero.jpg','asset-character-background':'character-background.png','asset-character-title':'character-title.png'}
const inventory={schema:'rendered-asset-inventory/v1',brand:'re1999-v2',capturedAt:raw.capturedAt,loadedResourceCount:raw.assets.length,assets:Object.entries(assetUrls).map(([id,url])=>{const localPath=`${base}/captures/source/assets/${assetFiles[id]}`;return {id,sourceUrl:url,loaded:raw.assets.some(a=>a.url===url),initiatorType:raw.assets.find(a=>a.url===url)?.initiatorType||'css-or-runtime',use:id.includes('home')?'home':id.includes('news')?'news':'character-gallery',cache:ref(localPath),sourceSha256:sha(localPath),hashStatus:'cached-and-hashed',evidenceRefs:claims.filter(c=>c.assetRefs?.includes(id)).map(c=>c.id)}}),allLoadedResources:raw.assets}
fs.writeFileSync(abs(`${base}/rendered-asset-inventory.json`),JSON.stringify(inventory,null,2))

const section={schema:'brand-section-fidelity-manifest/v1',brand:'re1999-v2',goalId:'re1999-full-revalidation-v2',sections:[
  {id:'home-archive-stage',sourcePageId:'home',status:'source-observed',sourceCapture:ref(capture('home')),sourceRegion:[0,0,1,1],structureLayers:['full-viewport motion background','foreground character stage','perimeter archival labels','download/action cluster'],readingOrder:['brand mark/nav','hero stage','perimeter label','download actions'],interactionStates:['default','transition','settled','restored'],assetEvidence:['asset-home-kv-video','asset-home-label']},
  {id:'news-editorial-split',sourcePageId:'news',status:'source-observed',sourceCapture:ref(capture('news')),sourceRegion:[0.064,0.15,0.872,0.674],structureLayers:['feature image','News title/category capsule','five-row editorial index','More action'],readingOrder:['feature image','News heading','category tabs','dated list','More'],interactionStates:['default','news1-transition','news1-settled','restored']},
  {id:'character-triptych',sourcePageId:'character-gallery',status:'source-observed',sourceCapture:ref(capture('character-gallery')),sourceRegion:[0.06,0.1,0.88,0.82],structureLayers:['staggered portrait rail','oblique framed character stage','title/quote/voice column'],readingOrder:['portrait rail','main character','character title','quote','voice action'],interactionStates:['default','transition','settled','restored'],assetEvidence:['asset-character-background','asset-character-title']}
]}
fs.writeFileSync(abs(`${base}/section-fidelity-manifest.json`),JSON.stringify(section,null,2))
console.log('built evidence artifacts')
