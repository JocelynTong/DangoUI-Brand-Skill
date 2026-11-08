<template>
  <div class="brand-cover" :class="`brand-cover--${brand.id}`" :data-cover-kind="contract.kind" :data-cover-direction="contract.direction" aria-hidden="true" inert>
    <template v-if="brand.id === 'pokemon-tcg-official'">
      <div class="art-stage pokemon-stage">
        <img src="/assets/brand-assets/pokemon-tcg-official/booster-art-1.jpg" alt="" />
        <div class="art-shade"></div>
        <header><strong>POKÉMON TCG</strong><span>OFFICIAL</span></header>
      </div>
    </template>

    <template v-else-if="brand.id === 'onepiece-cardgame'">
      <div class="art-stage op-stage">
        <img class="op-art" src="/assets/brand-assets/onepiece-cardgame/source/hero-current-st36.webp" alt="" />
        <div class="art-shade"></div>
        <img class="op-logo" src="/assets/brand-assets/onepiece-cardgame/source/logo-op.png" alt="" />
        <div class="op-tag"><strong>PRODUCTS</strong><span>01 / 05</span></div>
      </div>
    </template>

    <template v-else-if="brand.id === 'czn'">
      <div class="cz-shell">
        <img class="cz-art" src="/assets/brand-assets/czn/home-poster.jpg" alt="" />
        <div class="cz-shade"></div>
        <nav><img src="/assets/brand-assets/czn/nav-logo.png" alt="" /><b>GAMEPLAY</b><span>CHARACTER</span></nav>
      </div>
    </template>

    <template v-else-if="brand.id === 're1999'">
      <div class="art-stage r99-stage">
        <img class="r99-art" src="/assets/brand-assets/re1999/cover-hero.jpg" alt="" />
        <div class="art-shade"></div>
        <img class="r99-logo" src="/assets/brand-assets/re1999/cover-title.png" alt="" />
        <span class="r99-caption">THE STORM · ARCHIVE 1999</span>
      </div>
    </template>

    <template v-else-if="brand.id === 'duolingo-official'">
      <div class="art-stage du-stage">
        <img src="/assets/brand-assets/duolingo-official/character-cover.png" alt="" />
        <span class="du-action">继续</span>
      </div>
    </template>

    <template v-else-if="brand.id === 'hpma'">
      <div class="art-stage hpma-stage">
        <img src="/assets/hpma-bg-home.jpg" alt="" />
        <div class="art-shade"></div>
        <img class="hpma-title" src="/assets/hpma-slogan.png" alt="" />
      </div>
    </template>

    <template v-else-if="brand.id === 'linjie'">
      <div class="linjie-stage">
        <header><small>BUSINESS COMPONENTS</small><strong>临界</strong><span>FEED · TRADE · POST</span></header>
        <div class="linjie-feed-card"><div class="linjie-feed-card__author"><i>临</i><span><b>临界创作者</b><small>刚刚 · 作品发布</small></span><em>•••</em></div><div class="linjie-feed-card__media"><span>作品内容</span></div><div class="linjie-feed-card__copy"><strong>新的创作正在发生</strong><span>♡ 128　◇ 24　↗</span></div></div>
        <div class="linjie-trade-tile"><span>竞拍活动</span><strong>¥999</strong><small>距截拍 23:59</small></div>
      </div>
    </template>

    <template v-else-if="brand.id === 'identity-v-official'">
      <div class="art-stage identity-stage">
        <img :src="'./brand-candidates/identity-v/assets/464c61a9bf4882130025.jpg'" alt="" />
        <div class="art-shade"></div>
      </div>
    </template>
    <template v-else>
      <div class="status-stage is-identity">
        <small>LEARNING / IN PROGRESS</small>
        <strong>IDENTITY <i>V</i></strong>
        <p>EVIDENCE 01 / 03</p>
      </div>
    </template>
    <span class="cover-state">{{ coverState }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { brandCoverContracts } from './brand-cover-contract.mjs';
const props = defineProps({ brand: { type: Object, required: true } });
const contract = computed(() => brandCoverContracts[props.brand.id]);
const coverState = computed(() => ({ approved:'VERIFIED', 'qa-pending':'QA PENDING', rework:'REWORK', 'needs-evidence':'NEEDS EVIDENCE' }[contract.value.status]));
</script>

<style scoped>
.brand-cover{position:absolute;inset:0;overflow:hidden;background:#f4f3ef;color:#171719;font-family:Inter,system-ui,sans-serif}.cover-state{position:absolute;right:18px;bottom:14px;z-index:8;padding:4px 7px;border:1px solid currentColor;border-radius:999px;background:rgb(12 12 14 / 36%);color:#fff;font-size:7px;font-weight:800;letter-spacing:1.2px;backdrop-filter:blur(8px)}
.art-stage{position:relative;width:100%;height:100%;overflow:hidden}.art-stage>img:first-child{width:100%;height:100%;object-fit:cover}.art-shade{position:absolute;inset:0}.pokemon-stage>img{object-position:center 47%}.pokemon-stage .art-shade{background:linear-gradient(90deg,rgb(3 20 43 / 58%),transparent 48%),linear-gradient(0deg,rgb(1 12 24 / 25%),transparent 45%)}.pokemon-stage header{position:absolute;z-index:2;left:28px;top:27px;display:grid;color:#fff;text-shadow:0 2px 12px #00152b}.pokemon-stage header strong{font-size:18px;font-style:italic}.pokemon-stage header span{margin-top:4px;color:#bce9ff;font-size:7px;letter-spacing:1.8px}
.op-stage .op-art{object-position:56% 40%}.op-stage .art-shade{background:linear-gradient(90deg,rgb(13 9 3 / 62%),transparent 48%),linear-gradient(0deg,rgb(13 9 3 / 36%),transparent 45%)}.op-logo{position:absolute;z-index:2;left:25px;top:24px;width:122px!important;height:auto!important;object-fit:contain!important;filter:drop-shadow(0 3px 8px #0008)}.op-tag{position:absolute;z-index:2;left:28px;bottom:27px;display:flex;align-items:center;gap:12px;color:#fff}.op-tag strong{font:25px Impact,Oswald,sans-serif;letter-spacing:.8px}.op-tag span{padding-left:12px;border-left:1px solid rgb(255 255 255 / 55%);font:8px monospace;letter-spacing:1.2px}
.brand-cover--czn{background:#07090c;color:#efefed}.cz-shell{position:relative;height:100%;overflow:hidden;padding:22px 28px}.cz-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:51% 48%;filter:saturate(.9) contrast(1.06)}.cz-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgb(5 7 10 / 64%) 0 18%,transparent 48%),linear-gradient(0deg,rgb(5 7 10 / 28%),transparent 45%)}.cz-shell nav{position:relative;z-index:2;display:flex;align-items:center;gap:16px;font-size:8px;letter-spacing:1.6px;text-shadow:0 2px 10px #000}.cz-shell nav img{width:86px;height:auto;object-fit:contain}.cz-shell nav b{color:#ff5514}
.r99-stage .r99-art{object-position:center 42%}.r99-stage .art-shade{background:linear-gradient(90deg,rgb(6 10 13 / 22%),transparent 55%),linear-gradient(0deg,rgb(4 7 9 / 55%),transparent 50%)}.r99-logo{position:absolute;z-index:2;left:30px;top:28px;width:112px!important;height:auto!important;object-fit:contain!important;filter:drop-shadow(0 2px 8px #0009)}.r99-caption{position:absolute;z-index:2;left:31px;bottom:27px;color:#e8dccb;font:8px monospace;letter-spacing:1.7px}
.du-stage{background:#eef3ff}.du-stage>img{object-fit:cover!important;object-position:center 46%}.du-action{position:absolute;z-index:2;left:28px;bottom:28px;min-width:120px;padding:10px 22px;border-radius:11px;background:#58cc02;color:#fff;font-weight:800;text-align:center;box-shadow:0 5px 0 #58a700}
.hpma-stage .art-shade{background:linear-gradient(90deg,rgb(5 10 12 / 58%),transparent 48%),linear-gradient(0deg,rgb(6 9 10 / 46%),transparent 50%)}.hpma-stage>img:first-child{object-position:center 52%}.hpma-title{position:absolute;z-index:2;left:28px;top:28px;width:245px!important;height:auto!important;object-fit:contain!important;filter:drop-shadow(0 3px 12px #000)}
.brand-cover--linjie{background:#eeedf0;color:#141316}.linjie-stage{position:relative;display:grid;height:100%;grid-template-columns:.7fr 1.15fr .55fr;align-items:center;gap:15px;padding:22px 25px;background:linear-gradient(135deg,#f7f6f8,#e9e7ec)}.linjie-stage::after{position:absolute;inset:0;background:linear-gradient(90deg,transparent 0 64%,rgb(114 71 220 / 7%));content:''}.linjie-stage header{position:relative;z-index:2;display:grid;align-content:center;gap:5px}.linjie-stage header small{font-size:6px;font-weight:800;letter-spacing:1.25px;color:#7247dc}.linjie-stage header strong{font-size:33px;letter-spacing:-2px}.linjie-stage header span{font-size:6px;font-weight:700;letter-spacing:1px;color:#746f79}.linjie-feed-card{position:relative;z-index:2;overflow:hidden;border:1px solid #e2dfe6;border-radius:15px;background:#fff;box-shadow:0 13px 32px rgb(35 23 58 / 12%)}.linjie-feed-card__author{display:flex;align-items:center;gap:7px;padding:9px}.linjie-feed-card__author>i{display:grid;width:23px;height:23px;place-items:center;border-radius:50%;background:#ded1ff;color:#2b1ac0;font-size:9px;font-style:normal;font-weight:800}.linjie-feed-card__author>span{display:grid;flex:1}.linjie-feed-card__author b{font-size:8px}.linjie-feed-card__author small{font-size:5px;color:#928d96}.linjie-feed-card__author em{font-size:7px;font-style:normal;color:#999}.linjie-feed-card__media{position:relative;height:82px;background:linear-gradient(135deg,#241a3b,#755bb2 52%,#e7dfff)}.linjie-feed-card__media::before{position:absolute;inset:16px 48px;border:1px solid rgb(255 255 255 / 50%);border-radius:45% 55% 48% 52%;background:rgb(255 255 255 / 14%);content:'';transform:rotate(-12deg)}.linjie-feed-card__media span{position:absolute;left:9px;bottom:8px;color:#fff;font-size:6px;font-weight:800;letter-spacing:.8px}.linjie-feed-card__copy{display:grid;gap:5px;padding:9px}.linjie-feed-card__copy strong{font-size:8px}.linjie-feed-card__copy span{font-size:6px;color:#86808b}.linjie-trade-tile{position:relative;z-index:2;display:grid;align-content:end;gap:3px;height:126px;padding:12px;border-radius:15px;background:linear-gradient(145deg,#ffd49c,#fff1cb);box-shadow:0 13px 30px rgb(35 23 58 / 8%)}.linjie-trade-tile::before{position:absolute;inset:22px 18px 48px;border:1px solid rgb(255 255 255 / 70%);border-radius:46% 54% 43% 57%;background:rgb(255 255 255 / 32%);content:'';transform:rotate(11deg)}.linjie-trade-tile span{font-size:7px;font-weight:800}.linjie-trade-tile strong{color:#e57d43;font-size:14px}.linjie-trade-tile small{font-size:6px;color:#8f7f72}
.brand-cover--identity-v-official{background:radial-gradient(circle at 72% 28%,#46504a 0,transparent 34%),linear-gradient(145deg,#101412,#232a26);color:#e0e1dc}.status-stage{position:relative;display:flex;height:100%;flex-direction:column;justify-content:center;padding:32px 36px;isolation:isolate}.status-stage::before{position:absolute;right:-40px;bottom:-100px;z-index:-1;width:300px;height:300px;border:1px solid currentColor;border-radius:50%;content:'';box-shadow:0 0 0 36px rgb(255 255 255 / 2%),0 0 0 78px rgb(255 255 255 / 2%);opacity:.18}.status-stage small{position:absolute;top:30px;font:7px monospace;letter-spacing:1.8px;opacity:.55}.status-stage strong{font:40px/1.02 Georgia,serif;font-weight:400;letter-spacing:-1px}.status-stage strong i{color:#9c2926;font-size:56px;font-style:normal}.status-stage p{position:absolute;left:36px;bottom:28px;margin:0;font:8px monospace;letter-spacing:1.3px;opacity:.5}
@media(max-width:800px){.pokemon-stage header{left:22px}.op-logo{left:20px}.op-tag{left:22px}.r99-logo,.r99-caption{left:22px}.hpma-title{left:22px;width:220px!important}.linjie-stage{gap:10px;padding:16px}.linjie-stage header strong{font-size:27px}.linjie-feed-card__media{height:72px}.linjie-trade-tile{height:112px}.status-stage{padding-inline:26px}.status-stage p{left:26px}}
</style>
