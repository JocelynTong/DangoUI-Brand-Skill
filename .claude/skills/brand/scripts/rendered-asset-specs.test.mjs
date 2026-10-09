import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { inspectRenderedAsset } from './rendered-asset-specs.mjs';

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}

// A valid one-pixel transparent RGBA image, including actual compressed scanline bytes.
function transparentPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 0]))), pngChunk('IEND', Buffer.alloc(0))]);
}

async function inspect(bytes, mime, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rendered-specs-'));
  try {
    const file = path.join(directory, 'asset');
    await writeFile(file, bytes);
    await callback(await inspectRenderedAsset(file, mime));
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('real transparent PNG bytes expose intrinsic size and an alpha channel, not identity', async () => {
  const png = transparentPng();
  await inspect(png, 'image/png', (spec) => {
    assert.deepEqual(spec.intrinsicSize, { width: 1, height: 1 });
    assert.equal(spec.alphaChannel, 'present');
    assert.equal(spec.transparency, 'unknown');
    assert.deepEqual(spec.maxSafeDisplaySize, spec.intrinsicSize);
    assert.equal(spec.role, undefined);
    assert.equal(spec.identity, undefined);
  });
});

test('real GIF image bytes expose dimensions with unknown per-frame alpha', async () => {
  await inspect(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'), 'image/gif', (spec) => {
    assert.deepEqual(spec.intrinsicSize, { width: 1, height: 1 });
    assert.ok(['unknown', 'present'].includes(spec.alphaChannel));
  });
});

test('SVG retains width/height/viewBox and does not claim raster transparency', async () => {
  await inspect('<svg xmlns="http://www.w3.org/2000/svg" width="80px" height="40" viewBox="0 0 160 80"><path d="M0 0h10v10z"/></svg>', 'image/svg+xml', (spec) => {
    assert.deepEqual(spec.intrinsicSize, { width: 80, height: 40 });
    assert.deepEqual(spec.svg.viewBox, [0, 0, 160, 80]);
    assert.equal(spec.alphaChannel, 'unknown');
    assert.deepEqual(spec.maxSafeDisplaySize, { width: 80, height: 40 });
  });
});

test('viewBox alone and percentage sizing cannot establish intrinsic pixels', async () => {
  await inspect('<svg width="100%" viewBox="0 0 80 40"></svg>', 'image/svg+xml', (spec) => {
    assert.equal(spec.intrinsicSize, null);
    assert.equal(spec.maxSafeDisplaySize, null);
    assert.deepEqual(spec.svg.viewBox, [0, 0, 80, 40]);
  });
});

test('SVG one explicit dimension derives the second only from viewBox ratio', async () => {
  await inspect('<svg width="80" viewBox="0 0 160 80"></svg>', 'image/svg+xml', (spec) => assert.deepEqual(spec.intrinsicSize, { width: 80, height: 40 }));
});

test('unknown, truncated, corrupt, missing and media files remain unknown', async () => {
  const badChecksum = transparentPng();
  badChecksum[29] ^= 1;
  const badCompressedData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
  for (const bytes of [badChecksum, badCompressedData, Buffer.from('not an image'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from([255, 216, 255]), Buffer.from('<svg width="80"'), Buffer.from('RIFF1234WEBP')]) {
    await inspect(bytes, 'image/png', (spec) => {
      assert.equal(spec.inspection.status, 'unknown');
      assert.equal(spec.intrinsicSize, null);
      assert.equal(spec.maxSafeDisplaySize, null);
      assert.equal(spec.alphaChannel, 'unknown');
    });
  }
  assert.equal((await inspectRenderedAsset('/nonexistent/rendered-specs-file', 'video/mp4')).inspection.status, 'unknown');
});
