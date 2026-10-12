import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../public/site-theme.js', import.meta.url), 'utf8');
function boot(saved, blocked = false) {
  const listeners = {};
  const root = { dataset: {} };
  const media = { matches: false, addEventListener: (_, fn) => { listeners.system = fn; } };
  const window = { addEventListener: (name, fn) => { listeners[name] = fn; }, dispatchEvent() {} };
  const storage = { getItem() { if (blocked) throw Error(); return saved; }, setItem(_, value) { if (blocked) throw Error(); saved = value; } };
  vm.runInNewContext(source, { window, document: { documentElement: root }, matchMedia: () => media, localStorage: storage, Event });
  return { window, root, media, listeners, saved: () => saved };
}
const app = boot(null);
assert.equal(app.root.dataset.siteTheme, 'light');
app.media.matches = true; app.listeners.system();
assert.equal(app.root.dataset.siteTheme, 'dark');
app.window.siteTheme.set('light');
assert.equal(app.saved(), 'light');
app.listeners.system();
assert.equal(app.root.dataset.siteTheme, 'light');
assert.equal(boot(app.saved()).root.dataset.siteTheme, 'light');
app.listeners.storage({ key: 'dangoui-site-theme', newValue: 'dark' });
assert.equal(app.root.dataset.siteTheme, 'dark');
app.window.siteTheme.set('invalid');
assert.equal(app.window.siteTheme.get(), 'dark');
assert.equal(boot('invalid').window.siteTheme.get(), 'system');
const blocked = boot(null, true);
blocked.window.siteTheme.set('dark');
assert.equal(blocked.root.dataset.siteTheme, 'dark');
console.log('Site theme: system, manual override, persistence, frame sync and storage fallback passed.');
