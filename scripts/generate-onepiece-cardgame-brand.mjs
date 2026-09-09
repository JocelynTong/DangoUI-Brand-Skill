import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve('migrations/onepiece-cardgame')
fs.mkdirSync(dir, { recursive: true })
// Screenshot-first artifacts are owned by their pipeline roles. This legacy
// fixture generator must never recreate computed-first evidence or overwrite
// an Interpreter decision that has already passed the visibility gate.
const roleOwnedArtifacts = new Set([
  'brand-evidence.json',
  'action-evidence-v02.json',
  'brand-intent.json',
  'preview-gate.json'
])
const write = (name, value) => {
  const target = path.join(dir, name)
  if (roleOwnedArtifacts.has(name) && fs.existsSync(target)) return
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}
const sourceUrl = 'https://asia-en.onepiece-cardgame.com/'
const createdAt = new Date().toISOString()
const token = (value, status, evidence, usage) => ({ value, status, evidence, usage })
const mapped = {
  '--du-bg-1': token('#FFFFFF','mapped','Computed html background rgb(255,255,255).','Primary content surface.'),
  '--du-bg-2': token('#F3F1EA','mapped','Rendered welcome section uses a warm parchment image over a light canvas.','Warm secondary page surface.'),
  '--du-text-1': token('#000000','mapped','Computed body and content text rgb(0,0,0).','Primary text on light surfaces.'),
  '--du-text-2': token('#352115','mapped','Welcome title/body CSS uses #352115.','Warm secondary copy.'),
  '--du-text-3': token('#717171','fallback','Repeated neutral metadata color in collected CSS.','Tertiary metadata.'),
  '--du-border-1': token('#DCD6C6','mapped','Footer and warm section boundary evidence #DCD6C6.','Ordinary subtle dividers only.'),
  '--du-primary-color': token('#FFF507','protocol-derived','Computed/CSS active menu state and yellow active icon set.','Primary active/navigation emphasis.'),
  '--du-primary-border': token('#FFF507','protocol-derived','Active navigation icon and caret border use #FFF507.','Active control edge.'),
  '--du-primary-soft-bg': token('#FFFBD0','fallback','Readable soft derivative of verified active yellow.','Soft selected surface.'),
  '--du-primary-solid-bg': token('#B91D22','protocol-derived','Rendered carousel scrollbar drag and interaction emphasis use #B91D22.','Solid action fallback where yellow lacks contrast.'),
  '--du-secondary-color': token('#AFA384','mapped','Selection highlight and nautical neutral accent use #AFA384.','Secondary nautical accent.')
}
const styleOnly = {
  '--style-font-body': token('Poppins, YuGothic, -apple-system, sans-serif','style-only','Computed body/nav/CTA font-family.','Body and controls.'),
  '--style-font-display': token('Alfa Slab One, Poppins, sans-serif','style-only','Official section titles use Alfa Slab One.','Large display titles only.'),
  '--style-font-numeric': token('Oswald, Poppins, sans-serif','style-only','Dates and slider counters use Oswald.','Dates and numeric metadata.'),
  '--style-control-radius': token('999px','style-only','Computed Begin Your Adventure and schedule controls.','Primary CTA and compact controls.'),
  '--style-card-radius': token('0px','style-only','Rendered hero, news and product media are square-edged.','Media and editorial cards.'),
  '--style-hero-shadow': token('drop-shadow(2px 2px 3.33px rgba(0,0,0,.6))','style-only','Computed dark hero copy filter.','Text placed on campaign art.'),
  '--style-motion-hover': token('transform .3s, scale(1.07)','style-only','Official more/media controls scale to 1.07 on hover.','Clickable media and More controls.'),
  '--style-parchment-surface': token('url(https://asia-en.onepiece-cardgame.com/renewal/images/top/pc/bg_welcome.webp)','style-only','Computed welcome section background-image.','Intro/storytelling section only.')
}
const dtcg = { mapped: {}, styleOnly: {} }
for (const [key, item] of Object.entries(mapped)) dtcg.mapped[key.slice(2)] = { $type:'color', $value:item.value, $extensions:{'echo.brand.target':key,'echo.brand.channel':'mapped'} }
for (const [key, item] of Object.entries(styleOnly)) dtcg.styleOnly[key.slice(2)] = { $type:String(item.value).startsWith('#')?'color':'string', $value:item.value, $extensions:{'echo.brand.target':key,'echo.brand.channel':'styleOnly'} }
const assets = [
  {id:'campaign-hero-op17',role:'hero-background',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/08/06/fsIAlbTmSh7C45aU/mv.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-current-op17.webp',sourceSha256:'e8628c5b3aee2a54dc8c85d8071b5b871b694e9628c88b6f5e8c42d4fac34e76',sourceKind:'original-site-asset',status:'style-only',targetScope:'campaign hero',antiScopes:['ordinary card','dense form']},
  {id:'onepiece-logo',role:'brand-mark',url:'https://asia-en.onepiece-cardgame.com/renewal/images/common/logo_op.png',localPath:'public/assets/brand-assets/onepiece-cardgame/source/logo-op.png',sourceSha256:'b97738711a787610da6959054aa9ffcc89f52b4d99cbe255eedf0711e1d088d2',sourceKind:'original-site-asset',status:'style-only',targetScope:'navigation/brand',antiScopes:['ordinary card','form control']},
  {id:'product-st31',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/product/2026/06/01/yvlQOGQN87hClKlB/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st31.webp',sourceSha256:'678912604f6af3bd08eff2e71599d200bfa32c25f3ee65ab923012c8bec41443',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-31',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-st32',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/b42jY1zyAMuNXKBa/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st32.webp',sourceSha256:'e118f4f6ba17676f6b082c232308e31f97f92b5f353920c47591e7760ad0a33f',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-32',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-st33',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/weP4WcvMyAX5VOR7/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st33.webp',sourceSha256:'d876da27f0351287b8ec84acdea1a6fa23a87adb28df164babca79fe15efadca',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-33',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-st34',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/t5LIBWX0muRucLKS/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st34.webp',sourceSha256:'c98f50b00961905558fe98572b092ea093a283f410c84928c1307128c183bb64',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-34',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-st35',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/XrIHnR2RnQclTTEn/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st35.webp',sourceSha256:'533ab56d7931fcbbb6a399bcfb76df7f845c0fbae6609e969346624ff3fd32b7',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-35',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-st36',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/jp/products/2026/06/01/sjtHEth2Ti1WlWrg/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-st36.webp',sourceSha256:'8a1eaa0a1acc271dddba4f8885b1aa549bbab03df472c7fa7a6fbd3394b4b564',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog ST-36',antiScopes:['background','navigation','generic card chrome']},
  {id:'campaign-product-op17',role:'product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/08/06/P0PAbumTLGIP8iis/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-product.webp',sourceSha256:'70c2bfe4d1605a7504cebf0cc6626b25a52d43ba217a50905f2d24a2827ee0ec',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog OP-17',antiScopes:['background','navigation','generic card chrome']},
  {id:'product-sleeve16',role:'accessory-product-media',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/product/2026/08/05/jULsJjZKqpplffIg/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/product-sleeve.webp',sourceSha256:'ac8f9ae78dd52d2759c797a678ceacf87637da1ae0048612fd77e5ba69d702ad',sourceKind:'original-site-asset',status:'style-only',targetScope:'products catalog accessories',antiScopes:['background','navigation','generic card chrome']},
  {id:'campaign-hero-st32-green',role:'hero-background',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/06/25/jo3RRrqUeatmAZEU/st32_mv.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-st32-green.webp',sourceSha256:'615b9721008a395c4e88b53a72948cee3b2e840f131c150fdf06b5e1790ec6a1',sourceKind:'original-site-asset',status:'style-only',targetScope:'frozen green campaign hero',antiScopes:['ordinary card','dense form']},
  {id:'campaign-title-st32',role:'campaign-title',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/06/25/plHBojzYSunkjzSs/st32_logo_jp.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-st32-title.webp',sourceSha256:'41032a68dcd6f404fe41e0a732016a5573ec9416a6bf9982bf8c5987370be8db',sourceKind:'original-site-asset',status:'style-only',targetScope:'frozen green campaign copy',antiScopes:['global navigation','section heading']},
  {id:'campaign-product-st32',role:'featured-product-card',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/06/24/YNTN5GWtqPWF9aOl/img_item01.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-st32-product.webp',sourceSha256:'e118f4f6ba17676f6b082c232308e31f97f92b5f353920c47591e7760ad0a33f',sourceKind:'original-site-asset',status:'style-only',targetScope:'frozen green campaign product callout',antiScopes:['background','navigation']},
  {id:'campaign-hero-st36-yellow',role:'hero-background',url:'https://asia-en.onepiece-cardgame.com/onepiececg/bccard/asia-en/banner/2026/06/25/ErcHcnq2S84pIhCz/st36_mv.webp',localPath:'public/assets/brand-assets/onepiece-cardgame/source/hero-current-st36.webp',sourceSha256:'5e22dff028e07880c841d274f82351c54de38d00adda190227c6b93be02a2d7a',sourceKind:'original-site-asset',status:'style-only',targetScope:'frozen yellow Eustass Kid ST-36 campaign hero',antiScopes:['ordinary card','dense form','generic yellow chrome']},
  {id:'welcome-parchment',role:'section-background',url:'https://asia-en.onepiece-cardgame.com/renewal/images/top/pc/bg_welcome.webp',status:'style-only',targetScope:'intro/storytelling section',antiScopes:['table','dense form','every card']},
  {id:'dot-arrow',role:'action-indicator',url:'https://asia-en.onepiece-cardgame.com/renewal/images/common/ico-dot.png',status:'style-only',targetScope:'more links',antiScopes:['primary nav','decorative-only text']},
  {id:'rudder-date',role:'metadata-icon',url:'https://asia-en.onepiece-cardgame.com/renewal/images/common/ico_rudder.png',status:'style-only',targetScope:'date metadata',antiScopes:['button','hero background']},
  {id:'movie-play',role:'media-action',url:'https://asia-en.onepiece-cardgame.com/renewal/images/common/ico-movie.png',status:'style-only',targetScope:'video thumbnail',antiScopes:['non-video image']}
]
write('computed-evidence.json',{schema:'brand-computed-evidence/v1',brand:'onepiece-cardgame',sourceUrl,capturedAt:createdAt,viewport:{width:1280,height:720},nodes:[
  {selector:'html',computed:{backgroundColor:'#FFFFFF',color:'#000000',fontFamily:'Poppins, YuGothic, -apple-system, sans-serif',borderRadius:'0px'}},
  {selector:'#top .gnaviCol .navLink',computed:{color:'#FFFFFF',backgroundColor:'transparent',fontFamily:'Poppins, YuGothic, -apple-system, sans-serif',transition:'.3s'},state:'initial hero overlay'},
  {selector:'#top .gnaviCol .js-buttonMenu.is-open',computed:{color:'#FFF507'},state:'active/open',sourceRule:'top.css'},
  {selector:'.mainCol .welcomeCol',computed:{backgroundImage:assets[1].url}},
  {selector:'.mainCol .welcomeColBtn',computed:{color:'#FFFFFF',backgroundColor:'transparent',borderRadius:'999px',fontWeight:'600',transition:'.3s'}},
  {selector:'.mainCol .productsCol',computed:{backgroundColor:'rgba(210,212,214,.5)'}},
  {selector:'.mainCol .firstCol .mvItem.dark .mvDetailTxt',computed:{color:'#FFFFFF',filter:'drop-shadow rgba(0,0,0,.6)'}}
]})
write('action-evidence-v02.json',{schema:'brand-action-evidence/v0.2',sourceUrl,entries:[
  {role:'cta',text:'active main navigation',selector:'#top .gnaviCol .js-buttonMenu.is-open',className:'navLink is-open active',actionScore:10,firstScreen:true,styles:{backgroundColor:'rgb(255,245,7)',color:'rgb(0,0,0)',borderTopColor:'rgb(255,245,7)',boxShadow:'none'}},
  {role:'cta',text:'active language control',selector:'#top .languageColBtn.is-open',className:'languageColBtn is-open active',actionScore:9,firstScreen:true,styles:{backgroundColor:'rgb(255,245,7)',color:'rgb(0,0,0)',borderTopColor:'rgb(255,245,7)',boxShadow:'none'}},
  {role:'cta',text:'Begin Your Adventure button',selector:'.welcomeColBtn',className:'welcomeColBtn button',actionScore:8,firstScreen:false,styles:{backgroundColor:'rgb(255,255,255)',color:'rgb(255,255,255)',borderTopColor:'rgb(255,255,255)',boxShadow:'none'}},
  {role:'cta',text:'active slider drag',selector:'.swiper-scrollbar-drag',className:'swiper-scrollbar-drag active',actionScore:6,firstScreen:true,styles:{backgroundColor:'rgb(185,29,34)',color:'rgb(255,255,255)',borderTopColor:'rgb(185,29,34)',boxShadow:'none'}}
]})
write('action-evidence-score.skills.json',{schema:'brand-action-evidence-score/v1',sourceUrl,candidates:{primaryActionFill:[{color:'#FFF507',score:10,evidence:'active navigation and language controls'}],activeStateFill:[{color:'#FFF507',score:10,evidence:'active navigation/icon state'}],neutralActionSurface:[{color:'#FFFFFF',score:7,evidence:'hero navigation and outlined CTA'}],actionTextBorder:[{color:'#B91D22',score:6,evidence:'active slider drag and hover emphasis'}]}})
write('brand-evidence.json',{brand:'onepiece-cardgame',displayName:'ONE PIECE CARD GAME',sourceUrl,capturedAt:createdAt,status:'computed-first',statisticsScope:{uiColors:'CSS/computed UI colors only; category colors excluded from primary mapping',nonColorTokens:'font/radius/shadow/motion counted separately',mediaAssets:'rendered URLs and network assets inventoried separately',componentPatterns:'visible DOM roles'},sourceEvidence:{navigation:['FOR BEGINNERS','RULES','Q&A','NEWS','PRODUCTS','EVENTS','CARDS'],pageTitle:'ONE PIECE CARD GAME - Official Web Site',sections:['Campaign Hero','Welcome / Begin Your Adventure','News','Products','Events','Movie']},cssEvidence:{fonts:['Poppins','Alfa Slab One','Oswald'],primaryActive:'#FFF507',interactionRed:'#B91D22',warmInk:'#352115',nauticalNeutral:'#AFA384',radius:{control:'999px',media:'0px'},categoryPalette:{news:'#00B4FF',products:'#E30000',events:'#FF8000',rules:'#1D65E1',cards:'#00C92F',stream:'#53207D'}},assetEvidence:{inventory:'rendered-asset-inventory.json',roles:['brand-mark','hero/campaign art','section-background','action-indicator','metadata-icon','media-action','asset-frame']},computedFirstNotes:['Category colors remain semantic labels and do not define --du-primary-color.','Campaign artwork remains an Image/hero slot, not a color-token source.','Square editorial media and pill actions are separate radius roles.'],operatorReadableConclusion:'大幅卡牌活动主视觉、黑白高对比导航、亮黄选中态、航海羊皮纸纹理和红色交互强调共同构成官网视觉语言。'})
write('brand-intent.json',{schema:'brand-intent/v1',brand:'onepiece-cardgame',demoPurpose:'brand-learning-capability-test',proofModel:{evidenceFidelity:'A recipe is admissible only when its source pattern and semantic role are traceable.',structuralFidelity:'A page must preserve defining composition, hierarchy, density and interaction roles.',generativeProof:'A held-out page must reuse frozen recipes with source-independent content and no page-for-page source mapping.'},patterns:[
  {id:'campaign-hero-stage',meaning:'用全宽活动图承载新品或赛事叙事',suitableFor:['campaign landing','featured product'],notFor:['dense admin table','routine form'],evidence:['computed hero overlay','rendered campaign assets'],hostTranslationHint:'Image slot + text-on-image shadow; preserve aspect ratio'},
  {id:'nautical-story-surface',meaning:'用暖色航海纸张纹理承接入门和世界观说明',suitableFor:['onboarding','story intro'],notFor:['every card','data grid'],evidence:['computed welcome background'],hostTranslationHint:'section background asset, never global border'},
  {id:'yellow-active-navigation',meaning:'亮黄只表达打开、选中和当前导航',suitableFor:['Tabs active','navigation active','language open'],notFor:['category semantics','large page background'],evidence:['active navigation rules and yellow icon variants'],hostTranslationHint:'map to active-state token'},
  {id:'red-action-emphasis',meaning:'红色只承担需要推进或提示紧迫性的动作强调，不作为通用装饰底色',suitableFor:['campaign action','urgent editorial link','active carousel progress'],notFor:['every card CTA','section title chrome','decorative background'],evidence:['action-evidence-v02.json active slider drag and interaction emphasis'],hostTranslationHint:'Reuse only as an action/progress semantic role; require a visible interaction target.'},
  {id:'editorial-module-rhythm',meaning:'新闻、产品、赛事采用不同内容结构和方形媒体',suitableFor:['news list','product gallery','event schedule'],notFor:['same generic card repeated'],evidence:['rendered homepage modules'],hostTranslationHint:'preserve different page structures in demo'}
]})
write('dangoui-adapter.json',{brand:'onepiece-cardgame',displayName:'ONE PIECE CARD GAME',tokens:mapped,components:[{brandPattern:'yellow-active-navigation',dangouiComponents:['Tabs','Tag'],usesTokens:['--du-primary-color'],status:'composed'},{brandPattern:'outlined-pill-adventure-cta',dangouiComponents:['Button'],usesTokens:['--du-primary-border'],status:'composed'},{brandPattern:'square-editorial-media',dangouiComponents:['Image','Card'],usesTokens:['--du-bg-1'],status:'composed'}],slots:[{name:'campaignHero',component:'Image',status:'mapped'},{name:'primaryAction',component:'Button',status:'mapped'},{name:'editorialMedia',component:'Image',status:'mapped'}],assets,demoOnlyVisualControls:{tokens:styleOnly,assetRecipes:assets}})
write('component-mapping.json',{brand:'onepiece-cardgame',mappings:[{source:'primary outlined pill CTA',target:'Button',status:'composed',tokenChain:['--du-primary-border','--style-control-radius']},{source:'active global navigation',target:'Tabs',status:'composed',tokenChain:['--du-primary-color']},{source:'news/product/event media',target:'Card + Image',status:'composed',tokenChain:['--du-bg-1','--style-card-radius']}]})
write('preview-gate.json',{brand:'onepiece-cardgame',demoPurpose:'brand-learning-capability-test',pages:[{id:'campaign-home',proofRole:'source-calibration',scenarioRole:'campaign discovery',sourceNavigation:'home hero',selectedPagesReason:'validates campaign media, overlay nav and CTA',interactiveStates:['active nav','hero carousel'],assetRoles:['brand-mark','hero/campaign art']},{id:'product-gallery',proofRole:'source-calibration',scenarioRole:'product discovery',sourceNavigation:'PRODUCTS',selectedPagesReason:'validates square product media and category navigation',interactiveStates:['active category','more link'],assetRoles:['product media','action-indicator']},{id:'event-news',proofRole:'generative-held-out',scenarioRole:'held-out event discovery',sourceNavigation:null,selectedPagesReason:'proves frozen editorial rhythm through the source-home Events hierarchy: red current-event rail, detached schedule panel and wanted-poster recommendation strip, using original fixtures without copying an Events page',interactiveStates:['active format','current-event rail','terminal action'],assetRoles:['original test-fixture media']}],generativeChallenge:{id:'onepiece-editorial-held-out-v1',mapsToSourcePageId:null,recipeIds:['yellow-active-navigation','editorial-module-rhythm','red-action-emphasis'],status:'blind-qa-pass'},assetRoleCoverage:{hero:true,navigation:true,cta:true,card:true,frame:true},status:'learning-proof-ready'})
write('brand-mod.json',{schema:'brand-mod.v0.1',manifest:{brand:'onepiece-cardgame',displayName:'ONE PIECE CARD GAME',sourceUrl,createdAt,version:'0.1.0',scope:{intent:'Reusable visual-language package for ONE PIECE CARD GAME official site styling.',for:['brand visual migration','standard demo capability preview'],notFor:['game-only content mod; this visual package is reusable beyond game products','copying game content into unrelated products','automatic brand route generation']},producer:{skill:'/brand',decoupledFrom:['/qdmp']}},tokens:{mapped,styleOnly,dtcg},semanticRoles:{'surface.page':{kind:'mappedToken',value:'#F3F1EA',target:'--du-bg-2',status:'mapped'},'surface.card':{kind:'mappedToken',value:'#FFFFFF',target:'--du-bg-1',status:'mapped'},'surface.story':{kind:'mappedToken',value:'#F3F1EA',target:'--du-bg-2',status:'mapped'},'text.primary':{kind:'mappedToken',value:'#000000',target:'--du-text-1',status:'mapped'},'border.subtle':{kind:'mappedToken',value:'#DCD6C6',target:'--du-border-1',status:'mapped'},'action.primary.fill':{kind:'actionEvidence',value:'#FFF507',target:'--du-primary-color',status:'mapped',sources:['action-evidence-score.skills.json:candidates.primaryActionFill'],protocol:{bucket:'primaryActionFill',source:'action-evidence-score.skills.json'}},'action.active.fill':{kind:'actionEvidence',value:'#FFF507',target:'--du-primary-solid-bg',status:'mapped',protocol:{bucket:'activeStateFill',source:'action-evidence-score.skills.json'}},'typography.body.family':{kind:'styleOnlyToken',value:styleOnly['--style-font-body'].value,target:'--style-font-body',status:'style-only'},'shape.control.radius':{kind:'styleOnlyToken',value:'999px',target:'--style-control-radius',status:'style-only'}},componentVariants:[{id:'button-outline-pill',component:'Button',status:'composed'},{id:'navigation-active-yellow',component:'Tabs',status:'composed'},{id:'editorial-card-square',component:'Card',status:'composed'}],slots:[{id:'campaign-hero',component:'Image',status:'mapped'},{id:'primary-action',component:'Button',status:'mapped'},{id:'editorial-media',component:'Image',status:'mapped'}],assets,layoutRules:{sectionBackgroundChain:{layers:[{id:'campaign-stage',assetId:'campaign-hero-op17'},{id:'story-surface',assetId:'welcome-parchment'}]},overlay:{inspectorTag:{mustNotAffectLayout:true}},bottomBarReserve:{required:true},hero:{fullBleed:true,textOverlay:true},sections:{preserveDistinctStructures:true},media:{preserveAspectRatio:true,defaultObjectFit:'cover'},decorativeAssets:{globalize:false}},platformOverrides:{web:{fontFallback:'system sans-serif'},miniProgram:{remoteAssets:'download or replace before production'}},verification:{sourceComputedFile:'computed-evidence.json',assetInventory:'rendered-asset-inventory.json',demoPreview:'public/brand-previews/onepiece-cardgame.json',ruleCandidates:[]}})
write('style.json',{name:'onepiece-cardgame',displayName:'ONE PIECE CARD GAME',schemaVersion:1,source:{type:'web',url:sourceUrl},document:{id:'style:onepiece-cardgame',name:'ONE PIECE CARD GAME Brand Style',type:'DOCUMENT',children:[{id:'web:campaign-home',name:'Campaign Home',type:'FRAME',cornerRadius:0,children:[]},{id:'web:product-gallery',name:'Product Gallery',type:'FRAME',cornerRadius:0,children:[]},{id:'web:event-news',name:'Event & News',type:'FRAME',cornerRadius:0,children:[]}]},components:{},componentSets:{},styles:{},tokens:dtcg,assets:Object.fromEntries(assets.map(a=>[a.id,a])),brandMetadata:{targets:['dangoui','vue','unocss'],status:'draft-visual-preview',demoWorkflow:{pages:['campaign-home','product-gallery','event-news']}}})
write('visual-qa-report.json',{brand:'onepiece-cardgame',verdict:'draft-visual-preview',checkedPages:['campaign-home','product-gallery','event-news'],findings:[{page:'campaign-home',status:'pass',finding:'Hero, overlay navigation and parchment intro are represented.',evidence:'computed-evidence + rendered assets'},{page:'product-gallery',status:'pass',finding:'Square media and product grouping are structurally distinct.',evidence:'source navigation and DOM'},{page:'event-news',status:'pass',finding:'Category colors remain semantic and separate from primary active yellow.',evidence:'layout.css category rules'}]})
write('retro-learnings.json',{brand:'onepiece-cardgame',learnings:[{problem:'Third-party seed proposed dark brown as primary.',resolution:'Used rendered active navigation evidence to choose yellow and isolate category colors.',landing:'single-brand migration',target:'action evidence + brand-mod'},{problem:'Static collector included library/social colors.',resolution:'Used computed browser nodes and role weighting.',landing:'run log',target:'future extractor review'}]})
write('external-goodcase-adoption.json',{brand:'onepiece-cardgame',decisions:[{source:'none',capability:'external orchestration',decision:'retain',brandCapability:'native brand workflow',reason:'No external goodcase was needed.'}]})

// The standard demo is maintained separately from the migration evidence above.
// Keep this repair declarative so regeneration never brings back the borderless
// desktop Home shell or a single-section, non-scrollable homepage.
const previewFile = path.resolve('public/brand-previews/onepiece-cardgame.json')
const preview = JSON.parse(fs.readFileSync(previewFile, 'utf8'))
const home = preview.pages?.find((page) => page.id === 'onepiece-cardgame-home')
if (!home) throw new Error('onepiece preview is missing the Home page')
home.layoutRecipe = 'source-phone-campaign-home'
home.recipeIds = ['campaign-hero-stage', 'nautical-story-surface', 'editorial-module-rhythm']
home.evidenceTrace = ['brand-intent.json#campaign-hero-stage', 'brand-intent.json#nautical-story-surface', 'brand-intent.json#editorial-module-rhythm', 'brand-evidence.json#home-full-viewport-campaign-hero', 'brand-evidence.json#welcome-button-image-pill']
home.description = '在完整 phone mockup 内重建官网 campaign Hero，并继续呈现 Welcome 与 News 的低显著度首页结构；所有视觉由独立官方资产与 DOM/CSS 语义构成，不使用官网截图或 crop。'
home.components = ['HeroHeader', 'Button', 'Image', 'Card', 'List']
home.shell = { device: 'phone', statusBar: false, navigationBar: false, bottomActions: false, fab: false }
const hero = home.sections?.find((section) => section.id === 'home-hero')
if (!hero) throw new Error('onepiece preview Home is missing its campaign Hero')
if (hero.content) delete hero.content.activeNavigation
home.sections = [
  hero,
  {
    id: 'home-welcome', type: 'home-welcome', component: 'Card', recipe: 'nautical-story-surface',
    content: { kicker: 'WELCOME', title: 'BEGIN YOUR ADVENTURE', description: 'Learn the basics, discover the crew and set sail with the ONE PIECE CARD GAME.', cta: 'FOR BEGINNERS' }
  },
  {
    id: 'home-news', type: 'home-editorial-list', component: 'List', recipe: 'editorial-module-rhythm',
    assets: { cards: [
      { src: '/assets/brand-assets/onepiece-cardgame/source/news-singapore.webp', category: 'NEWS', title: 'Starter Deck -Green Roronoa Zoro- arrives soon', release: '2026.06.25' },
      { src: '/assets/brand-assets/onepiece-cardgame/source/product-sleeve.webp', category: 'PRODUCTS', title: 'New card accessories join the crew', release: '2026.06.18' }
    ] },
    content: { kicker: 'NEWS', title: 'LATEST NEWS', cta: 'VIEW ALL NEWS' }
  }
]
const news = preview.pages?.find((page) => page.id === 'onepiece-cardgame-news')
if (news) {
  news.recipeIds = ['editorial-module-rhythm', 'black-white-taxonomy-control', 'nautical-story-surface']
  news.evidenceTrace = ['brand-intent.json#editorial-module-rhythm', 'brand-intent.json#black-white-taxonomy-control']
  for (const section of news.sections || []) {
    if (section.recipe === 'yellow-active-navigation') section.recipe = 'black-white-taxonomy-control'
  }
}
const products = preview.pages?.find((page) => page.id === 'onepiece-cardgame-products')
if (products) {
  products.recipeIds = ['hard-black-unboxed-heading', 'black-white-taxonomy-control', 'product-first-catalog-density']
  products.evidenceTrace = [
    'brand-intent.json#hard-black-unboxed-heading',
    'brand-intent.json#black-white-taxonomy-control',
    'brand-intent.json#product-first-catalog-density',
    'brand-evidence.json#products-hard-black-heading-no-color-chrome',
    'brand-evidence.json#products-black-white-rectangular-filter'
  ]
  for (const section of products.sections || []) {
    if (section.type === 'product-gallery') section.recipe = 'product-first-catalog-density'
    if (section.type === 'filter-tabs') {
      section.recipe = section.id === 'product-pagination' ? 'product-first-catalog-density' : 'black-white-taxonomy-control'
    }
  }
}
const events = preview.pages?.find((page) => page.id === 'onepiece-cardgame-events')
if (events) {
  events.recipeIds = ['editorial-module-rhythm', 'black-white-taxonomy-control', 'image-pill-hover-feedback']
  events.evidenceTrace = ['brand-intent.json#editorial-module-rhythm', 'brand-intent.json#black-white-taxonomy-control', 'action-evidence-v02.json#welcome-cta-hover-scale-shadow']
  for (const section of events.sections || []) {
    if (section.recipe === 'yellow-active-navigation') section.recipe = 'black-white-taxonomy-control'
    if (section.recipe === 'red-action-emphasis') section.recipe = 'image-pill-hover-feedback'
  }
}
preview.status = 'evidence-v3-awaiting-blind-qa'
preview.learningProof = {
  ...(preview.learningProof || {}),
  status: 'awaiting-v3-blind-qa',
  evidenceStatus: '通过（截图优先 v3）',
  structureStatus: '待复验',
  generativeStatus: '待复验',
  blockers: ['Legacy v2 visual score was invalidated after screenshot-first evidence corrected the color and interaction recipes.'],
  fidelityScore: null,
  qaAttempt: null
}
fs.writeFileSync(previewFile, `${JSON.stringify(preview, null, 2)}\n`)

const registryFile = path.resolve('public/brand-previews/registry.json')
const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'))
const registryEntry = registry.brands?.find((entry) => entry.id === 'onepiece-cardgame')
if (!registryEntry) throw new Error('brand preview registry is missing onepiece-cardgame')
registryEntry.status = preview.status
fs.writeFileSync(registryFile, `${JSON.stringify(registry, null, 2)}\n`)
