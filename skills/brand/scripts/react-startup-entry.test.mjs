import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runApplyHostPreflight } from './apply-host-preflight.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-react-entry-'));
  const host = path.join(root, 'host');
  fs.mkdirSync(path.join(host, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'migrations', 'fixture'), { recursive: true });
  for (const name of ['brand-mod', 'brand-evidence', 'brand-intent']) fs.writeFileSync(path.join(root, 'migrations', 'fixture', `${name}.json`), '{}');
  fs.writeFileSync(path.join(host, 'package.json'), '{"dependencies":{"react":"19"}}');
  fs.writeFileSync(path.join(host, 'index.html'), '<script src="/config.js"></script><script type="module" src="/src/main.tsx"></script>');
  fs.writeFileSync(path.join(host, 'src/main.tsx'), `import { StrictMode } from 'react'; import { Landing as Screen } from './Landing'; createRoot(el).render(<StrictMode><Screen /></StrictMode>);`);
  fs.writeFileSync(path.join(host, 'src/Landing.tsx'), 'export function Landing(){return <main>Home</main>}');
  const run = (target = host) => runApplyHostPreflight({ root, brand: 'fixture', hostTarget: target, phase: 'design', write: false });
  return {root, host, run};
}
test('follows real named import, not an App filename guess; no output writes', () => {
  const {root, host, run} = fixture();
  const result = run();
  assert.equal(result.verdict, 'pass');
  assert.equal(result.startupPage.sourceFile, 'src/Landing.tsx');
  assert.equal(result.startupPage.route, '/');
  assert.equal(result.hostLayout.scannedFiles, 1);
  assert.equal(fs.existsSync(path.join(root, 'migrations/fixture/host-startup-page.json')), false);
  assert.equal(run(path.join(host, 'src/main.tsx')).startupPage.sourceFile, 'src/main.tsx');
});
test('multiple entry modules stay unresolved', () => {
  const {host,run} = fixture();
  fs.appendFileSync(path.join(host, 'index.html'), '<script type="module" src="/src/other.tsx"></script>');
  assert.ok(run().blocking.includes('HOST_STARTUP_PAGE_SOURCE_UNRESOLVED'));
});
test('router root is not silently treated as a resolved business page', () => {
  const {host,run} = fixture();
  fs.writeFileSync(path.join(host, 'src/Landing.tsx'), 'export function Landing(){return <RouterProvider router={router}/>;}');
  assert.ok(run().blocking.includes('HOST_STARTUP_PAGE_SOURCE_UNRESOLVED'));
});
test('out of host module is rejected', () => {
  const {root,host,run} = fixture();
  fs.writeFileSync(path.join(root, 'outside.tsx'), 'createRoot(el).render(<App/>);');
  fs.writeFileSync(path.join(host, 'index.html'), '<script type="module" src="../outside.tsx"></script>');
  assert.ok(run().blocking.includes('HOST_STARTUP_PAGE_SOURCE_UNRESOLVED'));
});
