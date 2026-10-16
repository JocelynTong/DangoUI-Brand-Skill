// Pure geometry: values are measured native logical pixels, never CSS/rpx guesses.
export function nativeNavigationGeometry({windowWidth, statusBarHeight, capsule, gap = 8}) {
  if (![windowWidth, statusBarHeight, gap].every(Number.isFinite) || windowWidth <= 0 || statusBarHeight < 0 || gap < 0)
    throw new Error('Measured native windowWidth and statusBarHeight required.');
  if (!capsule || !['top', 'bottom', 'left', 'right'].every(k => Number.isFinite(capsule[k])) ||
      capsule.top < statusBarHeight || capsule.bottom <= capsule.top || capsule.left < 0 ||
      capsule.right <= capsule.left || capsule.right > windowWidth)
    throw new Error('Valid measured native capsule required; do not substitute H5 geometry.');
  const safeTop = capsule.bottom + (capsule.top - statusBarHeight);
  return {statusBarHeight, safeTop, navigationHeight: safeTop - statusBarHeight,
    capsuleLeft: capsule.left, rightInset: windowWidth - capsule.left + gap};
}
