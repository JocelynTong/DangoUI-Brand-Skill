import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
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
  return { root, registryBase: `http://127.0.0.1:${server.address().port}/`, sourceUrl: "https://example.com/" };
}

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
