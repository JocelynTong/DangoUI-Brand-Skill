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
