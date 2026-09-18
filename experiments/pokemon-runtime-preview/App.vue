<script setup>
const assetRoot = '/assets/brand-assets/pokemon-tcg-official'
const decks = [
  { name: '皮卡丘电击', type: '玩家发布', rule: '标准赛制18.0', image: `${assetRoot}/card-database/SVP_EN_88.png` },
  { name: '火焰竞技', type: '赛事卡组', rule: '标准赛制18.0', image: `${assetRoot}/card-database/SVP_EN_27.png` },
  { name: '梦幻奇迹', type: '玩家发布', rule: '标准赛制17.5', image: `${assetRoot}/card-database/SVP_EN_85.png` },
  { name: '收藏研究', type: '赛事卡组', rule: '标准赛制18.0', image: `${assetRoot}/card-database/SVP_EN_101.png` },
]
const directions = [
  { id: 'arena', label: 'A', className: 'host--arena' },
  { id: 'album', label: 'B', className: 'host--album' },
  { id: 'archive', label: 'C', className: 'host--archive' },
]
</script>

<template>
  <main class="selection-surface" aria-label="宿主首页视觉方向选择">
    <section class="host-grid">
      <div v-for="direction in directions" :key="direction.id" class="direction-option">
        <div class="direction-badge" aria-hidden="true">{{ direction.label }}</div>
        <article :id="`host-option-${direction.id}`" class="host-preview" :class="direction.className">
        <header class="host-chrome">
          <div class="status-bar"><b>9:41</b><span>▮▮▮　⌁　▰</span></div>
          <div class="navigation-row">
            <div class="brand-title"><small>PTCG⌄</small><strong>牌组广场</strong></div>
            <div class="user-avatar" aria-label="我的">J</div>
            <div class="mini-capsule"><span>•••</span><i></i></div>
          </div>
        </header>

        <section class="identity-scene">
          <div class="scene-copy" v-if="direction.id === 'arena'"><small>TRAINER BATTLE</small><h1>为热爱<br>上场！</h1></div>
          <div class="scene-copy" v-else-if="direction.id === 'album'"><small>COLLECT · BUILD · PLAY</small><h1>好牌组<br>值得收藏</h1></div>
          <div class="scene-copy" v-else><small>DECK DATABASE</small><h1>快速找到<br>下一套牌组</h1></div>
        </section>

        <nav class="business-tabs"><b>卡组广场</b><span>赛事</span></nav>
        <div class="search-control"><span>⌕</span><em>搜索牌组</em><b>›</b></div>

        <section v-if="direction.id === 'arena'" class="featured-battle">
          <header><b>🔥 热门牌组</b><span>查看全部 ›</span></header>
          <div class="battle-stage">
            <div><img :src="decks[1].image" alt=""><strong>{{ decks[1].name }}</strong><small>{{ decks[1].rule }}</small></div>
            <em>VS</em>
            <div><img :src="decks[2].image" alt=""><strong>{{ decks[2].name }}</strong><small>{{ decks[2].rule }}</small></div>
          </div>
        </section>

        <section v-else-if="direction.id === 'album'" class="album-results">
          <header><b>本周精选</b><span>查看全部 ›</span></header>
          <div class="album-grid"><article v-for="(deck, index) in decks.slice(0, 2)" :key="deck.name"><i>0{{ index + 1 }}</i><img :src="deck.image" alt=""><div><strong>{{ deck.name }}</strong><small>{{ deck.type }} · 收藏 128</small></div></article></div>
        </section>

        <section v-else class="archive-results">
          <div class="filter-rail"><b>全部</b><span>玩家发布</span><span>赛事卡组</span></div>
          <header><b>全部牌组</b><span>1921 个结果</span></header>
          <div class="compact-rows"><article v-for="deck in decks.slice(0, 2)" :key="deck.name"><img :src="deck.image" alt=""><div><strong>{{ deck.name }}</strong><small>{{ deck.type }} · {{ deck.rule }}</small></div><b>›</b></article></div>
        </section>

        <section v-if="direction.id !== 'archive'" class="filter-panel">
          <div><b>分类</b><span class="is-active">全部</span><span>玩家发布</span><span>赛事卡组</span></div>
          <div><b>环境</b><span class="is-active">全部</span><span>标准赛制18.0</span><span>标准赛制17.5</span></div>
        </section>
        </article>
      </div>
    </section>
  </main>
</template>
