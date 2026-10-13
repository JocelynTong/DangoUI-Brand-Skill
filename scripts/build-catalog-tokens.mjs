import fs from 'node:fs/promises';
import StyleDictionary from 'style-dictionary';

// Thin legacy-value adapter, not a second token source or custom compiler.
const source = new URL('../migrations/onepiece-cardgame/brand-mod.json', import.meta.url);
const { tokens: { dtcg } } = JSON.parse(await fs.readFile(source, 'utf8'));
const surface = dtcg.mapped['du-bg-1'];
const radius = dtcg.styleOnly['style-card-radius'];
if (!/^#[\da-f]{6}$/i.test(surface.$value) || !/^\d+(\.\d+)?px$/.test(radius.$value)) throw Error('Unsupported legacy value: update the adapter explicitly');
const tokens = { $extensions: { 'com.dangoui.delivery': {
  status: 'local-component-trial', brandCertification: 'not-certified',
  basis: 'Generated from existing Brand MOD values; inherited descriptions are not a new source verification.',
} }, catalog: {
  surface: { ...surface, $value: { colorSpace: 'srgb', components: surface.$value.slice(1).match(/../g).map(v => parseInt(v, 16) / 255), alpha: 1 } },
  mediaRadius: { ...radius, $value: { value: parseFloat(radius.$value), unit: 'px' } },
} };
// Generated consumer snapshot; the Brand MOD remains the sole authoring source.
const tokenSnapshot = `${JSON.stringify(tokens, null, 2)}\n`;
const snapshotFile = new URL('../src/uikit/catalog.tokens.json', import.meta.url);
const sd = new StyleDictionary({ usesDtcg: true, tokens, platforms: { css: {
  transformGroup: 'css', prefix: 'kit',
  buildPath: new URL('../src/uikit/', import.meta.url).pathname,
  files: [{ destination: 'catalog-tokens.css', format: 'css/variables', options: { selector: '.catalog-grid[data-appearance="onepiece"]', showFileHeader: false } }],
} } });
if (process.argv.includes('--check')) {
  const [file] = await sd.formatPlatform('css');
  const current = await fs.readFile(new URL('../src/uikit/catalog-tokens.css', import.meta.url), 'utf8');
  if (current !== file.output) throw Error('Stale catalog tokens; run npm run build:catalog-tokens');
  if (await fs.readFile(snapshotFile, 'utf8') !== tokenSnapshot) throw Error('Stale packaged DTCG snapshot; run npm run build:catalog-tokens');
  console.log('Catalog generated tokens match canonical DTCG');
} else {
  await sd.buildAllPlatforms();
  await fs.writeFile(snapshotFile, tokenSnapshot);
}
