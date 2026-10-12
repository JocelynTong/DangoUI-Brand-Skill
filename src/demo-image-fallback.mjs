// Demo-only failure presentation. Keep the original img and its layout classes;
// do not change shared components, caller data, or video poster behaviour.
const prefix = 'data:image/svg+xml;charset=utf-8,';

export function applyDemoImageFallback(image) {
  if (image?.tagName !== 'IMG' || image.closest('.vl-cover') || image.src.startsWith(prefix)) return;
  const box = image.getBoundingClientRect();
  const width = Math.max(1, Math.round(box.width || image.width || 160));
  const height = Math.max(1, Math.round(box.height || image.height || 120));
  const compact = width < 100 || height < 60;
  const size = Math.min(24, width / 3, height / 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#e8e8e5"/><g transform="translate(${width / 2 - size / 2},${height / 2 - size / 2 - (compact ? 0 : 12)})" fill="none" stroke="#777872" stroke-width="1.5"><rect width="${size}" height="${size}" rx="3"/><path d="M2 ${size * .75} L${size * .35} ${size * .4} L${size * .6} ${size * .65} L${size * .8} ${size * .45} L${size - 2} ${size * .7}"/></g>${compact ? '' : `<text x="50%" y="${height / 2 + 24}" text-anchor="middle" fill="#62635e" font-family="sans-serif" font-size="12">图片暂不可用</text>`}</svg>`;
  // Avoid srcset selecting the failed remote resource again. A later Vue src
  // update can load normally; there is no persistent failed-state flag.
  image.removeAttribute('srcset');
  image.src = prefix + encodeURIComponent(svg);
}

export function installDemoImageFallback(root) {
  const onError = event => applyDemoImageFallback(event.target);
  root.addEventListener('error', onError, true);
  return () => root.removeEventListener('error', onError, true);
}
