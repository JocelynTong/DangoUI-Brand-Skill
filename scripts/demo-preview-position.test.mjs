import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPreviewPositions, restorePreviewPosition } from '../src/demo-preview-position.mjs';

test('history entries restore independently; new visits do not reuse a route position', () => {
  const history = { state: { existing: true }, replaceState(state) { this.state = state; } };
  let id = 0;
  const positions = createPreviewPositions(history, () => ++id);
  assert.equal(positions.enter(), 0);
  const first = history.state;
  assert.equal(first.existing, true);
  positions.save(356);
  history.state = null;
  assert.equal(positions.enter(), 0);
  const second = history.state;
  positions.save(80);
  history.state = first;
  assert.equal(positions.enter(), 356);
  history.state = second;
  assert.equal(positions.enter(), 80);
  history.state = null;
  assert.equal(positions.enter(), 0);
});

test('restoration waits for async content and releases observers after reaching position', () => {
  let callback, renderFrame, screen, disconnected = false;
  const listeners = new Map();
  const frame = {
    contentDocument: {
      querySelector: () => screen,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    },
    contentWindow: { requestAnimationFrame: fn => { renderFrame = fn; }, cancelAnimationFrame() {}, MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe() {}
      disconnect() { disconnected = true; }
    } },
  };
  const stop = restorePreviewPosition(frame, 356);
  renderFrame();
  assert.equal(disconnected, false);
  screen = { scrollTop: 0, scrollTo({ top, behavior }) { assert.equal(behavior, 'instant'); this.scrollTop = top; } };
  callback();
  assert.equal(screen.scrollTop, 0);
  renderFrame();
  assert.equal(screen.scrollTop, 356);
  assert.equal(disconnected, true);
  assert.equal(listeners.size, 0);
  frame.contentWindow = null; // Vue removed the old iframe before the next load.
  stop();
  restorePreviewPosition(frame, 0)();
});

test('mobile keyboard selection retains focus and canonical aliases preserve history state', () => {
  const source = readFileSync(new URL('../src/VariantLibrary.vue', import.meta.url), 'utf8');
  assert.match(source, /ref="menuToggle"/);
  assert.match(source, /menuOpen.value && event.detail === 0 && event.currentTarget.id === 'brand-directory'/);
  assert.match(source, /menuToggle.value\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /history.replaceState\(history.state,/);
});
