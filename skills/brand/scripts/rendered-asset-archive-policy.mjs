import path from "node:path";

export const MAX_RENDERED_ASSET_BYTES = 12 * 1024 * 1024;

export function shouldArchiveRenderedResponse({ resourceType = "", contentType = "", contentLength = 0, status = 0 } = {}) {
  const visual = ["image", "media"].includes(String(resourceType).toLowerCase())
    || /^(?:image|video)\//i.test(String(contentType));
  const length = Number(contentLength || 0);
  const responseStatus = Number(status || 0);
  const streamingMediaWithoutBound = String(resourceType).toLowerCase() === "media" && length === 0;
  return visual
    && responseStatus >= 200
    && responseStatus < 300
    && Number.isFinite(length)
    && length >= 0
    && length <= MAX_RENDERED_ASSET_BYTES
    && !streamingMediaWithoutBound;
}

export function extensionForRenderedAsset(url, contentType = "") {
  const mime = String(contentType).split(";")[0].trim().toLowerCase();
  const byMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };
  if (byMime[mime]) return byMime[mime];
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    if (/^\.(?:png|jpe?g|webp|gif|svg|mp4|webm)$/.test(extension)) return extension === ".jpeg" ? ".jpg" : extension;
  } catch {}
  return ".bin";
}
