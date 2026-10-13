import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
test('isolated tarball exports and SSR work with the local Vue peer, without Demo or research inputs', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-package-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const exec = (command, args, cwd = temporary) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
  };
  const packed = JSON.parse(exec('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--cache', path.join(temporary, 'cache'), '--pack-destination', temporary], path.join(root, 'src/uikit')))[0];
  const expected = ['package.json', 'CatalogProductGrid.mjs', 'CatalogSection.mjs', 'catalog.css', 'catalog-section.css', 'catalog-tokens.css', 'catalog.tokens.json', 'capabilities.json', 'USAGE.md'];
  assert.deepEqual(packed.files.map(f => f.path).sort(), expected.sort());
  assert.ok(packed.unpackedSize < 30000, 'Keep the local reference small, excluding artwork and research.');
  const modules = path.join(temporary, 'node_modules');
  const target = path.join(modules, '@dangoui/catalog-reference');
  fs.mkdirSync(target, { recursive: true });
  exec('tar', ['-xzf', path.join(temporary, packed.filename), '--strip-components=1', '-C', target]);
  // Share only the installed, declared Vue peer runtime. No source-app symlink.
  fs.symlinkSync(path.join(root, 'node_modules/vue'), path.join(modules, 'vue'));
  const result = exec(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import { createSSRApp, h } from 'vue';
    import { renderToString } from 'vue/server-renderer';
    import Grid from '@dangoui/catalog-reference/grid';
    import Section from '@dangoui/catalog-reference/section';
    for (const name of ['grid', 'section']) {
      const css = fs.readFileSync(new URL(import.meta.resolve('@dangoui/catalog-reference/' + name + '.css')), 'utf8');
      assert.ok(css.includes('@import'));
    }
    const read = spec => JSON.parse(fs.readFileSync(new URL(import.meta.resolve(spec))));
    const limits = read('@dangoui/catalog-reference/capabilities');
    assert.equal(limits.runtime, 'vue3-web-dom');
    assert.equal(limits.brandCertification, 'not-certified');
    assert.ok(limits.notSupported.includes('Taro or mini-program runtime'));
    const tokens = read('@dangoui/catalog-reference/tokens');
    assert.equal(tokens.catalog.mediaRadius.$type, 'dimension');
    assert.equal(tokens.$extensions['com.dangoui.delivery'].brandCertification, 'not-certified');
    const items = [{title:'Host record B',code:'B'}, {title:'Host record A',code:'A'}];
    const before = JSON.stringify(items);
    const html = await renderToString(createSSRApp({render:()=>h(Grid,{items,appearance:'onepiece'})}));
    assert.ok(html.indexOf('Host record B') < html.indexOf('Host record A'));
    assert.equal((html.match(/<article /g)||[]).length,2);
    assert.equal(JSON.stringify(items),before);
    const empty = await renderToString(createSSRApp({render:()=>h(Section,{items:[],filters:[],emptyText:'No host results'})}));
    assert.ok(empty.includes('No host results'));
    assert.ok(!empty.includes('<button'));
    const record = { src: '/caller-image.png', alt: 'A & B', title: '<script>bad</script>', code: '<ID>', cta: 'View item' };
    const rendered = await renderToString(createSSRApp({render:()=>h(Section,{items:[record],filters:['ALL','DECKS'],appearance:'onepiece'})}));
    assert.ok(rendered.includes('src="/caller-image.png"'));
    assert.ok(rendered.includes('alt="A &amp; B"'));
    assert.ok(rendered.includes('&lt;script&gt;bad&lt;/script&gt;'));
    assert.ok(rendered.includes('&lt;ID&gt;'));
    assert.ok(!rendered.includes('<script>'));
    assert.ok(rendered.includes('<span>View item</span>'));
    assert.ok(!rendered.includes('<a '));
    const buttons = rendered.match(/<button[^>]*>/g) || [];
    assert.equal(buttons.length, 2);
    assert.ok(buttons.every(button => / disabled(?:[ =>])/.test(button)));
    const fallback = await renderToString(createSSRApp({render:()=>h(Grid,{items:[{title:'No image'}]})}));
    assert.ok(fallback.includes('asset missing'));
    assert.ok(fallback.includes('data-appearance="legacy"'));
    assert.throws(()=>import.meta.resolve('@dangoui/catalog-reference/CatalogSection.stories.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
    console.log('Two host-shaped records and empty state render from packed exports; no branding or native-runtime claim.');
  `]);
  assert.match(result, /render from packed exports/);
  // Resolve each stylesheet import using only the actual tarball.
  for (const css of ['catalog-section.css', 'catalog.css', 'catalog-tokens.css']) {
    const content = fs.readFileSync(path.join(target, css), 'utf8');
    for (const match of content.matchAll(/@import\s+['"]([^'"]+)['"]/g)) assert.ok(fs.existsSync(path.resolve(target, match[1])));
    assert.doesNotMatch(content, /url\s*\(/, 'This reference must not hide asset/network dependencies.');
  }
});
