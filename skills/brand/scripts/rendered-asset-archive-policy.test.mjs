import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_RENDERED_ASSET_BYTES,
  extensionForRenderedAsset,
  shouldArchiveRenderedResponse,
} from "./rendered-asset-archive-policy.mjs";

test("archives successful visual responses", () => {
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "image", contentType: "image/webp", status: 200, contentLength: 42 }), true);
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "media", contentType: "video/mp4", status: 206, contentLength: 2048 }), true);
});

test("rejects nonvisual, failed, and oversized responses", () => {
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "stylesheet", contentType: "text/css", status: 200 }), false);
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "image", contentType: "image/png", status: 404 }), false);
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "media", contentType: "video/mp4", status: 206, contentLength: 0 }), false);
  assert.equal(shouldArchiveRenderedResponse({ resourceType: "image", contentType: "image/png", status: 200, contentLength: MAX_RENDERED_ASSET_BYTES + 1 }), false);
});

test("uses mime first and safe URL extensions second", () => {
  assert.equal(extensionForRenderedAsset("https://a.test/file", "image/png"), ".png");
  assert.equal(extensionForRenderedAsset("https://a.test/file.JPEG", "application/octet-stream"), ".jpg");
  assert.equal(extensionForRenderedAsset("https://a.test/file", "application/octet-stream"), ".bin");
});
