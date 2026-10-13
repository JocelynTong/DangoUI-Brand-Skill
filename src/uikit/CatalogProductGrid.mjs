import { defineComponent, h } from 'vue';

// Extracted from App.vue's SchemaContentCardsSection. Keep legacy classes so
// existing brand recipes continue to own appearance, without a second renderer.
// Standalone ONE PIECE product-gallery usage:
// import CatalogProductGrid from './CatalogProductGrid.mjs';
// import './catalog.css';
// h(CatalogProductGrid, { items, appearance: 'onepiece', emptyText: '没有匹配结果' })
// items: { src, alt?, title?, category?, code?, release?, cta? }[].
// No data fetching, filtering, navigation or global stylesheet dependency.
// Other brand/section recipes retain appearance='legacy' and their own CSS.
export default defineComponent({
  name: 'CatalogProductGrid',
  props: {
    items: { type: Array, default: () => [] },
    sectionType: { type: String, default: 'product-gallery' },
    assetKind: { type: String, default: 'products' },
    emptyText: { type: String, default: 'assets missing' },
    appearance: { type: String, default: 'legacy' },
  },
  setup(props) {
    const classes = (part) => [
      `source-schema-demo__product-${part}`,
      `source-schema-demo__product-${part}--${props.sectionType}`,
      `source-schema-demo__product-${part}--${props.assetKind}`,
    ];
    return () => h('div', { class: ['catalog-grid', ...classes('grid')], 'data-appearance': props.appearance }, props.items.length
      ? props.items.map((asset) => h('article', { class: classes('card') }, [
        asset.src
          ? h('img', { class: classes('art'), src: asset.src, alt: asset.alt || asset.title || 'asset' })
          : h('div', { class: 'source-schema-demo__missing' }, 'asset missing'),
        asset.category || asset.code
          ? h('div', { class: 'source-schema-demo__product-meta' }, [
            asset.category ? h('span', asset.category) : null,
            asset.code ? h('small', asset.code) : null,
          ]) : null,
        h('strong', asset.title || asset.alt || 'Asset'),
        asset.release ? h('small', { class: 'source-schema-demo__product-release' }, asset.release) : null,
        asset.cta ? h('span', asset.cta) : null,
      ]))
      : h('div', { class: 'source-schema-demo__missing' }, props.emptyText));
  },
});
