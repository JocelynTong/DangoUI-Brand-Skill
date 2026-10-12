import { createApp, h, ref, computed } from 'vue';
import mod from '../../migrations/onepiece-cardgame/brand-mod.json';
import preview from '../../public/brand-previews/onepiece-cardgame.json';
import Grid from '../uikit/CatalogProductGrid.mjs';
import '../uikit/catalog.css';
import './onepiece.css';

const tokens = Object.values(mod.tokens.dtcg).flatMap(group => typeof group === 'object' ? Object.values(group).filter(t => t?.$type) : []);
const vars = Object.fromEntries(tokens.map(t => [t.$extensions['echo.brand.target'], t.$value]));
const products = preview.pages.find(p => p.id === 'onepiece-cardgame-products').sections.find(s => s.id === 'product-grid').assets.products;
const labels = {'--du-bg-1':'内容画布','--du-bg-2':'暖纸背景','--du-text-3':'辅助文字','--du-border-1':'柔和分隔线','--du-primary-color':'导航选中','--du-primary-border':'选中边缘','--du-primary-soft-bg':'柔和选中底色','--du-primary-solid-bg':'实色操作回退','--du-secondary-color':'航海中性色'};
const statuses = {mapped:'已映射',fallback:'回退值','protocol-derived':'协议派生','style-only':'样式规则'};
const section = (id, n, title, intro, children) => h('section',{id,class:'chapter'},[h('div',{class:'section-label'},`${n} / ${id.toUpperCase()}`),h('h2',title),h('p',{class:'intro'},intro),...children]);
createApp({setup(){
 const filter=ref('ALL'), query=ref(''), state=ref('default'), radius=ref(null), notice=ref('');
 const selected=computed(()=>products.filter(p=>(filter.value==='ALL'||p.category===filter.value)&&`${p.title} ${p.code}`.toLowerCase().includes(query.value.toLowerCase())));
 const grid=(items)=>h(Grid,{items,appearance:'onepiece',emptyText:'没有匹配的商品，请调整关键词或分类。',style:radius.value===null?{}:{'--kit-catalog-media-radius':`${radius.value}px`}});
 return ()=>h('div',{class:'sheet',style:vars},[
 h('header',{class:'topbar'},[h('a',{href:'#',class:'wordmark'},'DangoUI / Brand studies'),h('span',{class:'edition'},'EXPERIMENT 01 · 航海王'),h('a',{href:'#implementation'},'查看接入情况 ↗')]),
 h('main',[
 h('section',{class:'hero'},[h('div',[h('p',{class:'section-label'},'DESIGN SYSTEM STUDY / 2026'),h('h1',['ONE PIECE',h('br'),'CARD GAME']),h('p',{class:'hero-sub'},'把品牌语言，放到眼前。'),h('p',{class:'intro'},'以项目现有品牌包为依据：明亮导航、暖纸底色、硬边商品图与有力量的标题。逐项查看颜色、文字、控件，以及它们组合后的实际效果。'),h('div',{class:'hero-tags'},[h('span','品牌规范可视化'),h('span','Vue Web 实验'),h('span','既有素材复用')])]),h('div',{class:'hero-art'},[h('img',{src:products[0].src,alt:products[0].title}),h('span',{class:'art-caption'},'SOURCE ASSET / ST-31'),h('strong','SET SAIL.')])]),
 h('nav',{class:'index','aria-label':'章节导航'},['colors','typography','components','catalog','implementation'].map((id,i)=>h('a',{href:`#${id}`},`${String(i+1).padStart(2,'0')} ${['色彩','排版','形状与控件','商品目录','接入情况'][i]}`))),
 section('colors','01','色彩各司其职。','黄色用于导航强调；暖灰承接内容。保留品牌包中的派生值和回退标记，避免把它们误读成官网原始色。',[
 h('div',{class:'swatches'},tokens.filter(t=>t.$type==='color').map(t=>h('article',{class:'swatch'},[h('div',{class:'paint',style:{background:`var(${t.$extensions['echo.brand.target']})`}}),h('div',{class:'swatch-body'},[h('strong',labels[t.$extensions['echo.brand.target']]),h('span',{class:'hex'},t.$value),h('code',t.$extensions['echo.brand.target']),h('small',statuses[t.$extensions['echo.brand.status']]),h('details',[h('summary','来源与用途'),h('p',t.$description),h('p',t.$extensions['echo.brand.usage'])])])])))]),
 section('typography','02','标题有声量，信息有秩序。','字体族读取品牌包。Alfa Slab One 与 Oswald 使用仓库字体；Poppins 未提供字体文件，正文采用系统回退。以下字号为本实验展示尺度，尚非完整品牌字号 Token。',[
 h('div',{class:'type-row'},[h('code','DISPLAY / Alfa Slab One · 桌面 44px / 窄屏 32px'),h('div',{class:'display-sample'},'YOUR NEXT ADVENTURE')]),
 h('div',{class:'type-row'},[h('code','BODY / system fallback · 16px'),h('div',{style:{fontFamily:'var(--style-font-body)'}},'从第一副卡组开始，找到属于你的航线。 Build your crew. Start your journey.')]),
 h('div',{class:'type-row'},[h('code','NUMERIC / Oswald · 桌面 48px / 窄屏 38px'),h('div',{class:'numeric'},'ST-31 / 2026.10.11')])]),
 section('components','03','硬边陈列，圆角行动。','这些控件用于演示品牌变量的组合，属于本页样例；商品目录在下一节调用现有共享组件。',[
 h('div',{class:'specimens'},[h('div',{class:'specimen'},[h('p',{class:'section-label'},'PILL / 999px'),h('div',{class:'button-row'},[h('button',{class:'pill',onClick:()=>notice.value='已触发样例操作；不提交任何业务数据。'},'开始冒险 ↗'),h('button',{class:'pill outline',onClick:()=>notice.value='已触发次级操作样例。'},'了解更多'),h('button',{class:'pill',disabled:true},'暂未开放')]),h('p',{role:'status',class:'hint'},notice.value||'可点击体验 · 禁用态透明度为展示规则')]),h('div',{class:'specimen'},[h('p',{class:'section-label'},'SQUARE / 0px'),h('div',{class:'shape-sample'},[h('strong','PRODUCTS'),h('span','图片与内容保持硬边；不把所有元素统一成圆角卡片。')])])])]),
 section('catalog','04','让真实组件说话。','下方直接使用项目的 CatalogProductGrid，数据来自现有品牌预览。搜索和状态切换由本实验提供，非实时商品服务。',[
 h('div',{class:'catalog-toolbar'},[h('label',['搜索商品',h('input',{type:'search',placeholder:'试试 ST-31 或 Luffy',value:query.value,onInput:e=>query.value=e.target.value})]),h('label',['显示状态',h('select',{value:state.value,onChange:e=>state.value=e.target.value},[['default','正常'],['empty','空数据'],['loading','加载中'],['error','出错']].map(([v,t])=>h('option',{value:v},t)))])]),
 h('div',{class:'filters'},['ALL','DECKS','BOOSTERS','OTHER'].map(f=>h('button',{'aria-pressed':filter.value===f,onClick:()=>filter.value=f},f))),
 h('div',{class:'catalog-layout'},[h('div',{class:'catalog-frame'},[h('div',{class:'catalog-title'},[h('h3','PRODUCTS'),h('span',{role:'status'},state.value==='default'?`${selected.value.length} 件示例商品`:'状态演示')]),state.value==='loading'?h('div',{class:'state-box',role:'status'},'正在加载商品…'):state.value==='error'?h('div',{class:'state-box',role:'alert'},[h('p','商品暂时加载失败'),h('button',{onClick:()=>state.value='default'},'重试')]):grid(state.value==='empty'?[]:selected.value)]),h('aside',{class:'recipe'},[h('p',{class:'section-label'},'LIVE TOKEN / 实时试验'),h('h3','一处改动，观察组件。'),h('p','拖动媒体圆角，观察下方商品图边角变化；恢复后回到品牌包默认值。'),h('label',['媒体圆角',h('input',{type:'range',min:0,max:32,value:radius.value??0,onInput:e=>radius.value=Number(e.target.value),'aria-label':'媒体圆角'}),h('output',`${radius.value??0}px`)]),h('button',{onClick:()=>radius.value=null},'恢复默认'),h('p',{class:'hint'},radius.value===null?'当前：生成 CSS 默认值':'当前：临时样式覆盖，未修改品牌包'),h('hr'),h('strong','实际接通 2 个 Token'),h('p','背景 / 媒体圆角'),h('p',{class:'hint'},'字号、间距等仍来自现有组件 CSS；本实验如实呈现。')])])]),
 section('implementation','05','看见效果，也看见边界。','本页是一个品牌设计系统展示实验，尚未代表全品牌认证或小程序适配完成。',[
 h('div',{class:'connection-list'},[['颜色、字体与形状','从 Brand MOD 的 DTCG 字段读取','本页规范样例'],['商品目录','复用 src/uikit/CatalogProductGrid.mjs','Vue Web 真实组件'],['目录 Token','现有 Style Dictionary → CSS → 组件','背景与圆角已接通'],['暗色主题 / Taro Vue','当前试验未提供','待适配']].map(([a,b,c])=>h('div',[h('strong',a),h('span',b),h('small',c)]))),h('details',[h('summary','查看数据来源'),h('p','migrations/onepiece-cardgame/brand-mod.json · tokens.dtcg'),h('p','public/brand-previews/onepiece-cardgame.json · 商品示例'),h('p','src/uikit/catalog.tokens.json → catalog-tokens.css → catalog.css'),h('p','独立品牌研究实验，非 ONE PIECE 官方设计系统；品牌与素材权利归原权利人。')])]),
 h('footer',[h('strong','DangoUI / Brand studies'),h('span','01 — ONE PIECE CARD GAME · 实验展示')])])]);
}}).mount('#app');
