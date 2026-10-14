import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { resolvePublicStylePack } from "./resolve-public-style-pack.mjs";

async function fixture(t, handler) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-registry-network-"));
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  // Deliberately leave only this tiny test fixture; no recursive cleanup.
  return { root, cacheRoot:path.join(root,'cache'), registryBase: `http://127.0.0.1:${server.address().port}/`, sourceUrl: "https://example.com/" };
}

test('a fresh isolated run reuses verified public bytes after partial failure, never stale metadata', async t => {
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const files = {'/data.json':Buffer.from('{"v":1}'), '/frame.png':Buffer.from('frame'), '/asset.png':Buffer.from('asset')};
  const manifest = {artifacts:{data:'/data.json'}, artifactHashes:{data:sha(files['/data.json'])},
    evidenceAssets:[{path:'/frame.png',installPath:'frame.png',sha256:sha(files['/frame.png'])}],
    runtimeAssets:[{path:'/asset.png',installPath:'public/assets/brand-assets/demo/asset.png',sha256:sha(files['/asset.png'])}]};
  let failAsset = true;
  const hits = [];
  const options = await fixture(t,(req,res)=>{
    hits.push(req.url);
    if (req.url==='/asset.png' && failAsset) {res.writeHead(404);res.end();return;}
    res.setHeader('content-type','application/json');
    res.end(files[req.url] || JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]}
      : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : manifest));
  });
  await assert.rejects(resolvePublicStylePack({...options,install:true}), /404/);
  failAsset=false; hits.length=0;
  const second=await resolvePublicStylePack({...options,root:path.join(options.root,'new-run'),install:true});
  assert.equal(second.cachedFiles.length,2);
  assert.deepEqual(second.downloadedFiles,['public/assets/brand-assets/demo/asset.png']);
  assert.equal(hits.includes('/data.json'),false);assert.equal(hits.includes('/frame.png'),false);
  assert.ok(hits.includes('/manifest.json'));
  // Corruption forces a real verified fetch, without accepting poisoned cache.
  fs.writeFileSync(path.join(options.cacheRoot,manifest.evidenceAssets[0].sha256),'corrupt');
  hits.length=0;
  const third=await resolvePublicStylePack({...options,root:path.join(options.root,'third-run'),install:true});
  assert.deepEqual(third.downloadedFiles,['migrations/demo/frame.png']);
  assert.equal(third.cachedFiles.length,2);
  // A new publication at the same URL is authoritative, not the old hash cache.
  files['/data.json']=Buffer.from('{"v":2}');manifest.artifactHashes.data=sha(files['/data.json']);hits.length=0;
  const fourth=await resolvePublicStylePack({...options,root:path.join(options.root,'fourth-run'),install:true});
  assert.deepEqual(fourth.downloadedFiles,['migrations/demo/data.json']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(options.root,'fourth-run/migrations/demo/data.json'))).v,2);
  const oldHash=manifest.artifactHashes.data;
  // Wrong remote bytes must neither install nor populate the declared cache key.
  manifest.artifactHashes.data='a'.repeat(64);
  await assert.rejects(resolvePublicStylePack({...options,root:path.join(options.root,'bad-run'),install:true}), /hash mismatch/);
  assert.equal(fs.existsSync(path.join(options.cacheRoot,manifest.artifactHashes.data)),false);
  assert.ok(fs.existsSync(path.join(options.cacheRoot,oldHash)));
});

test('resume fetches only missing or corrupt files using the current manifest hashes', async t => {
  const bytes = Buffer.from('{}\n');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const hits = [];
  const manifest = {artifacts:{data:'/data.json'},artifactHashes:{data:hash},evidenceAssets:[{path:'/frame.png',installPath:'frame.png',sha256:hash}],runtimeAssets:[{path:'/asset.png',installPath:'public/asset.png',sha256:hash}]};
  const options = await fixture(t,(req,res)=>{
    hits.push(req.url);
    res.setHeader('content-type','application/json');
    res.end(req.url.endsWith('index.json') ? JSON.stringify({brands:[{id:'demo',manifest:'/manifest.json'}]}) : req.url.endsWith('by-source.json') ? JSON.stringify({sources:{'https://example.com/':'demo'}}) : req.url.endsWith('manifest.json') ? JSON.stringify(manifest) : bytes);
  });
  const dir=path.join(options.root,'migrations/demo');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'data.json'),bytes);
  fs.writeFileSync(path.join(dir,'frame.png'),'corrupt');
  const first=await resolvePublicStylePack({...options,install:true});
  assert.deepEqual(first.reusedFiles,['migrations/demo/data.json']);
  assert.equal(first.downloadedFiles.length,2);
  assert.equal(hits.includes('/data.json'),false);
  hits.length=0;
  const second=await resolvePublicStylePack({...options,install:true});
  assert.equal(second.reusedFiles.length,3);
  assert.equal(second.downloadedFiles.length,0);
  assert.deepEqual(hits.sort(),['/brand-registry/v0.1/by-source.json','/brand-registry/v0.1/index.json','/manifest.json']);
  // Changed publication at the same URL must invalidate the old local bytes.
  manifest.artifactHashes.data='0'.repeat(64);
  await assert.rejects(resolvePublicStylePack({...options,install:true}),/Registry artifact hash mismatch/);
  assert.ok(hits.includes('/data.json'));
  assert.equal(fs.readFileSync(path.join(dir,'data.json'),'utf8'),bytes.toString());
});

test("remote Registry that never sends headers fails with bounded timeout", async (t) => {
  const options = await fixture(t, () => {});
  const started = performance.now();
  await assert.rejects(resolvePublicStylePack({ ...options, requestTimeoutMs: 80, networkTimeoutMs: 300 }), { code: "REGISTRY_NETWORK_TIMEOUT" });
  assert.ok(performance.now() - started < 1500);
  assert.equal(fs.existsSync(path.join(options.root, "migrations")), false);
});

test("timeout covers a stalled body after successful HTTP headers", async (t) => {
  const options = await fixture(t, (_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"unfinished":');
  });
  await assert.rejects(resolvePublicStylePack({ ...options, requestTimeoutMs: 80, networkTimeoutMs: 300 }), { code: "REGISTRY_NETWORK_TIMEOUT" });
});

test("sequential manifest request shares the total resolution deadline", async (t) => {
  let manifestRequested = false;
  const options = await fixture(t, (req, res) => {
    if (req.url.endsWith("manifest.json")) { manifestRequested = true; return; }
    setTimeout(() => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(req.url.endsWith("index.json")
        ? { brands: [{ id: "demo", manifest: "/manifest.json" }] }
        : { sources: { "https://example.com/": "demo" } }));
    }, 90);
  });
  const started = performance.now();
  await assert.rejects(resolvePublicStylePack({ ...options, requestTimeoutMs: 500, networkTimeoutMs: 180 }), { code: "REGISTRY_NETWORK_TIMEOUT" });
  assert.equal(manifestRequested, true);
  assert.ok(performance.now() - started < 400, "must not grant a fresh request timeout to the manifest");
});

test("HTTP failure is not disguised as absent brand or timeout", async (t) => {
  const options = await fixture(t, (_req, res) => { res.writeHead(503); res.end("unavailable"); });
  await assert.rejects(resolvePublicStylePack({ ...options, requestTimeoutMs: 200, networkTimeoutMs: 500 }), /Registry request failed \(503\)/);
});

test("healthy remote Registry still resolves a real manifest", async (t) => {
  const options = await fixture(t, (req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url.endsWith("index.json")
      ? { brands: [{ id: "demo", version: "1", manifest: "/manifest.json" }] }
      : req.url.endsWith("by-source.json")
        ? { sources: { "https://example.com/": "demo" } }
        : { artifacts: {}, runtimeAssets: [] }));
  });
  const result = await resolvePublicStylePack({ ...options, requestTimeoutMs: 500, networkTimeoutMs: 1000 });
  assert.equal(result.matched, true);
  assert.equal(result.source, "public");
  assert.equal(result.brand, "demo");
});

test('selected published package is not shadowed by same-named local trial', async t => {
  let requests=0;
  const options=await fixture(t,(req,res)=>{
    requests++;res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(req.url.endsWith('index.json')?{brands:[{id:'demo',version:'published',manifest:'/manifest.json'}]}:{artifacts:{},runtimeAssets:[]}));
  });
  const migration=path.join(options.root,'migrations/demo');fs.mkdirSync(migration,{recursive:true});
  const old=JSON.stringify({manifest:{brand:'demo',version:'unapproved-local'}});
  fs.writeFileSync(path.join(migration,'brand-mod.json'),old);
  const result=await resolvePublicStylePack({...options,sourceUrl:`${options.registryBase}#/brand/demo/pages/home`});
  assert.equal(result.source,'public');assert.equal(result.version,'published');assert.equal(requests,2);
  assert.equal(fs.readFileSync(path.join(migration,'brand-mod.json'),'utf8'),old);
});

test('package files download with bounded concurrency under the same deadline', async t => {
  let active = 0, peak = 0;
  const artifacts = Object.fromEntries(Array.from({length:16},(_,i)=>[`file${i}`,`/file${i}.json`]));
  const options = await fixture(t,(req,res)=>{
    res.setHeader('content-type','application/json');
    if (/\/file\d+\.json$/.test(req.url)) {
      active++; peak=Math.max(peak,active);
      setTimeout(()=>{active--;res.end('{}');},60);
    } else res.end(JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]} : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : {artifacts}));
  });
  const result = await resolvePublicStylePack({...options,install:true,networkTimeoutMs:650});
  assert.equal(result.installedFiles.length,16);
  assert.ok(peak>1 && peak<=8);
});

test('downloaded evidence with a wrong hash is rejected before writing it', async t => {
  const options = await fixture(t,(req,res)=>{
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]} : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : req.url.endsWith('manifest.json') ? {evidenceAssets:[{path:'/frame.png',installPath:'frame.png',sha256:'wrong'}]} : {}));
  });
  await assert.rejects(resolvePublicStylePack({...options,install:true}),/Registry evidence hash mismatch/);
  assert.equal(fs.existsSync(path.join(options.root,'migrations/demo/frame.png')),false);
});

test('complete package transfer is not cut off by metadata lookup budget', async t => {
  const options = await fixture(t, (req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/file.json') return setTimeout(() => res.end('{}'), 220);
    res.end(JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]} : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : {artifacts:{file:'/file.json'}}));
  });
  const result = await resolvePublicStylePack({...options,install:true,networkTimeoutMs:150,downloadTimeoutMs:600,requestTimeoutMs:400});
  assert.equal(result.installedFiles.length,1);
});

test('a transient failed file is retried once, not the whole package', async t => {
  const counts = {};
  const options = await fixture(t, (req, res) => {
    counts[req.url] = (counts[req.url] || 0) + 1;
    if (req.url === '/file.json' && counts[req.url] === 1) { res.writeHead(503); res.end(); return; }
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]} : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : req.url.endsWith('manifest.json') ? {artifacts:{file:'/file.json'}} : {}));
  });
  const result = await resolvePublicStylePack({...options,install:true,downloadTimeoutMs:1000});
  assert.equal(result.installedFiles.length,1);
  assert.equal(counts['/file.json'],2);
  assert.equal(counts['/manifest.json'],1);
});

test('missing files are not retried and stalled transfers still have a hard deadline', async t => {
  for (const status of [404, 0]) {
    let calls = 0;
    const options = await fixture(t, (req,res) => {
      if (req.url === '/file.json') { calls++; if(status) { res.writeHead(status);res.end(); } return; }
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(req.url.endsWith('index.json') ? {brands:[{id:'demo',manifest:'/manifest.json'}]} : req.url.endsWith('by-source.json') ? {sources:{'https://example.com/':'demo'}} : {artifacts:{file:'/file.json'}}));
    });
    const started=performance.now();
    await assert.rejects(resolvePublicStylePack({...options,install:true,downloadTimeoutMs:250,requestTimeoutMs:1000}), status ? /failed \(404\)/ : {code:'REGISTRY_NETWORK_TIMEOUT'});
    assert.equal(calls,1);
    assert.ok(performance.now()-started < 800);
    assert.equal(fs.existsSync(path.join(options.root,'migrations/demo/file.json')),false);
  }
});
