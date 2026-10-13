import { componentNames, componentSlug, foundationNames } from './dango-catalog.mjs';
export function canonicalDocumentHash(hash, search = '') {
  const params = new URLSearchParams(search);
  if (params.has('variantEmbed') || params.has('inspectorEmbed')) return hash;
  const aliases = {
    '#/variants/onepiece-cardgame/design-system': '#/variants/onepiece-cardgame/foundations/overview',
    '#/variants/onepiece-cardgame/foundations': '#/variants/onepiece-cardgame/foundations/overview',
    '#/variants/onepiece-cardgame/components': '#/variants/onepiece-cardgame/components/inspector',
    '#/variants/dango/dango-button': '#/variants/dango/components/button',
    '#/brand/dango/style/color': '#/variants/dango/foundations/color',
    '#/brand/dango/style/typography': '#/variants/dango/foundations/typography',
    '#/brand/dango/style/button': '#/variants/dango/components/button',
    '#/brand/dango/components/button': '#/variants/dango/components/button',
    '#/brand/dango/components/navigation-bar': '#/variants/dango/components/navigation-bar',
    '#/brand/dango/components/switch': '#/variants/dango/components/switch',
    '#/variants/dango/foundations/button': '#/variants/dango/components/button',
    '#/variants/dango/foundations': '#/variants/dango/foundations/color',
    '#/variants/dango/components': '#/variants/dango/components/inspector',
  };
  for (const name of componentNames) aliases[`#/brand/dango/components/${componentSlug(name)}`] = `#/variants/dango/components/${componentSlug(name)}`;
  for (const name of componentNames) aliases[`#/brand/onepiece-cardgame/components/${componentSlug(name)}`] = `#/variants/onepiece-cardgame/components/${componentSlug(name)}`;
  for (const item of foundationNames) aliases[`#/brand/onepiece-cardgame/style/${item.id}`] = `#/variants/onepiece-cardgame/foundations/${item.id}`;
  aliases['#/brand/onepiece-cardgame/style/button'] = '#/variants/onepiece-cardgame/components/button';
  for (const item of foundationNames) aliases[`#/brand/dango/style/${item.id}`] = `#/variants/dango/foundations/${item.id}`;
  return aliases[hash] || hash;
}
