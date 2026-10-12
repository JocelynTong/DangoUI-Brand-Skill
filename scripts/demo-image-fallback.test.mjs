import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDemoImageFallback, installDemoImageFallback } from '../src/demo-image-fallback.mjs';

const image = (width = 160, height = 120) => ({
  tagName: 'IMG', src: '/missing.webp', alt: '商品标题', className: 'product-art',
  closest: () => null, getBoundingClientRect: () => ({ width, height }),
  removeAttribute(name) { this.removed = name; },
});
test('failure keeps image dimensions, alt and classes, without remote fallback', () => {
  const img = image();
  applyDemoImageFallback(img);
  const svg = decodeURIComponent(img.src);
  assert.match(svg, /width="160" height="120"/);
  assert.match(svg, /图片暂不可用/);
  assert.equal(img.alt, '商品标题');
  assert.equal(img.className, 'product-art');
  assert.equal(img.removed, 'srcset');
  const first = img.src;
  applyDemoImageFallback(img);
  assert.equal(img.src, first);
});
test('small icons omit cramped text; new sources can fail independently', () => {
  const img = image(32, 32);
  applyDemoImageFallback(img);
  assert.ok(!decodeURIComponent(img.src).includes('图片暂不可用'));
  img.src = '/another-missing.webp';
  applyDemoImageFallback(img);
  assert.ok(img.src.startsWith('data:image/svg+xml'));
});
test('preserves existing cover handling and ignores video errors', () => {
  const cover = image(); cover.closest = () => ({});
  applyDemoImageFallback(cover);
  assert.equal(cover.src, '/missing.webp');
  applyDemoImageFallback({ tagName: 'VIDEO' });
});
test('uses one removable capture listener for non-bubbling image errors', () => {
  let registered;
  const root = {
    addEventListener(...args) { registered = args; },
    removeEventListener(...args) { assert.deepEqual(args, registered); },
  };
  const dispose = installDemoImageFallback(root);
  assert.equal(registered[0], 'error'); assert.equal(registered[2], true);
  const img = image(); registered[1]({ target: img });
  assert.ok(img.src.startsWith('data:image/svg+xml')); dispose();
});
