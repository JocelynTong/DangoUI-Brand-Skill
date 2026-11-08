export const brandCoverContracts = {
  dango: {
    status: 'approved', direction: 'original-library-cover', kind: 'typographic-composition',
    evidence: ['original-variant-library-typographic-cover'],
    represents: '原品牌库的 Dango / Design → Build 字排封面',
    forbidden: ['新增按钮舞台', '营销 Hero', '虚构插画'],
  },
  'pokemon-tcg-official': {
    status: 'approved', direction: 'art-led-database', kind: 'asset-component-composition',
    evidence: ['database-dense-query-organism-current', 'semantic-database-search-default'],
    represents: '卡牌对象、检索入口与浏览密度',
    forbidden: ['只放一张主视觉', '把活动 CTA 当全局按钮'],
  },
  'onepiece-cardgame': {
    status: 'approved', direction: 'art-led-product', kind: 'asset-component-composition',
    evidence: ['product-first-catalog-density', 'black-white-taxonomy-control', 'hard-black-unboxed-heading'],
    represents: '产品优先的连续目录与黑白分类控制',
    forbidden: ['黄色全局 Chrome', '等权 SaaS 卡片', '单张官网截图'],
  },
  czn: {
    status: 'qa-pending', direction: 'art-led-media', kind: 'asset-component-composition',
    evidence: ['gameplay-media-timeline-hud', 'orange-current-navigation-role'],
    represents: '主媒体板、边缘导航和纵向进度 HUD',
    forbidden: ['通用暗色卡片', '橙色 CTA 填充', '静态网页截图'],
  },
  re1999: {
    status: 'rework', direction: 'art-led-archive', kind: 'asset-component-composition',
    evidence: ['asymmetric-editorial-index', 'copper-paper-role-boundary'],
    represents: '单一视觉主位与高密度五行资讯索引',
    forbidden: ['失败角色主图', '铜色全局主按钮', '等权卡片网格'],
  },
  hpma: {
    status: 'needs-evidence', direction: 'observed-home-stage', kind: 'asset-status-composition',
    evidence: ['home-dark-cinematic-stage', 'cards-media-illustrated-book-stage'],
    represents: '库内已记录的首页月夜舞台；仍明确缺失 NEWS／交互／素材来源闭环',
    forbidden: ['虚构魔法组件', '把题材金色当品牌 Token', '伪造正式品牌封面'],
  },
  'duolingo-official': {
    status: 'qa-pending', direction: 'art-led-action', kind: 'asset-component-composition',
    evidence: ['expressive-character-moment', 'productive-raised-action', 'productive-content-card'],
    represents: '限域角色鼓励、真实内容卡和单一主行动',
    forbidden: ['只放绿色按钮', '全局绿色', '把课程机制复制到宿主'],
  },
  'identity-v-official': {
    status: 'needs-evidence', direction: 'evidence-progress', kind: 'evidence-status',
    evidence: ['archived-homepage-local-demo-candidate'],
    represents: '已有首页素材、交互 Demo 与 Web 按钮候选；完整学习仍待证据',
    forbidden: ['通用暗黑风', '虚构角色或 HUD', '冒充完成学习'],
  },
  linjie: {
    status: 'qa-pending', direction: 'business-component-board', kind: 'component-specimen',
    evidence: ['figma-poll-light-dark', 'figma-feed-post', 'figma-trade-profile-message', 'dangoui-linjie-theme'],
    represents: '临界 Figma 中的 Feed／Post／Trade 业务组件与明暗主题结构',
    forbidden: ['只用一个紫色按钮代表品牌', '导出或伪造私有插画素材', '把结构化复刻冒充完整 App 交付'],
  },
};

export const brandCoverIds = Object.keys(brandCoverContracts);
