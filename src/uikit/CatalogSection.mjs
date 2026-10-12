import { defineComponent, h } from 'vue';
import CatalogProductGrid from './CatalogProductGrid.mjs';

// Presentational composition only. The host owns schema metadata and business logic.
export default defineComponent({
  name: 'CatalogSection',
  props: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    label: { type: String, default: 'Card · schema' },
    filters: { type: Array, default: () => [] },
    items: { type: Array, default: () => [] },
    appearance: { type: String, default: 'legacy' },
    sectionType: { type: String, default: 'product-gallery' },
    assetKind: { type: String, default: 'products' },
    emptyText: { type: String, default: 'assets missing' },
  },
  setup(props) {
    return () => h('section', { class: 'catalog-section', 'data-appearance': props.appearance }, [
      h('span', { class: 'tag' }, props.label),
      h('strong', props.title),
      h('p', props.description),
      props.filters.length ? h('div', { class: 'source-schema-demo__catalog-filters' }, props.filters.map((item, index) =>
        h('button', { type: 'button', class: index === 0 || item?.active ? 'active' : '' }, item?.label || String(item)),
      )) : null,
      h(CatalogProductGrid, { items: props.items, appearance: props.appearance, sectionType: props.sectionType, assetKind: props.assetKind, emptyText: props.emptyText }),
    ]);
  },
});
