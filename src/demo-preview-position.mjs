// Session-only positions, keyed by history entry rather than route: opening the
// same scene through a new link must still start at the top.
export function createPreviewPositions(history, makeId = () => crypto.randomUUID()) {
  const positions = new Map();
  let current;
  return {
    enter() {
      current = history.state?.demoPreviewEntry;
      if (!current) {
        current = makeId();
        history.replaceState({ ...history.state, demoPreviewEntry: current }, '');
      }
      return positions.get(current) || 0;
    },
    save(top) { if (current) positions.set(current, top); },
  };
}

// The iframe's Vue content can mount after load. Wait for the real scroll area,
// and for enough content to restore the saved offset. Never focus the iframe.
export function restorePreviewPosition(frame, top) {
  const doc = frame.contentDocument;
  if (!doc || !top) return () => {};
  const frameWindow = frame.contentWindow;
  let pending;
  const stop = () => {
    frameWindow.cancelAnimationFrame(pending);
    observer.disconnect();
    doc.removeEventListener('load', restore, true);
    doc.removeEventListener('wheel', stop, true);
    doc.removeEventListener('touchstart', stop, true);
    doc.removeEventListener('keydown', stop, true);
  };
  const apply = () => {
    const screen = doc.querySelector('.phone-screen');
    if (!screen) return;
    screen.scrollTo({ top, behavior: 'instant' });
    if (Math.abs(screen.scrollTop - top) < 1) stop();
  };
  const restore = () => {
    frameWindow.cancelAnimationFrame(pending);
    // Vue's nextTick initializes the phone scroll position after mounting.
    // Apply ours on the next rendering frame, after those microtasks finish.
    pending = frameWindow.requestAnimationFrame(apply);
  };
  const observer = new frameWindow.MutationObserver(restore);
  observer.observe(doc, { childList: true, subtree: true });
  doc.addEventListener('load', restore, true);
  for (const event of ['wheel', 'touchstart', 'keydown']) doc.addEventListener(event, stop, true);
  restore();
  return stop;
}
