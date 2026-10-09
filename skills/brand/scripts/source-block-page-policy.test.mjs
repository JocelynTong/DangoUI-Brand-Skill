import assert from "node:assert/strict";
import test from "node:test";
import { detectBlockedHtml } from "./source-block-page-policy.mjs";

test("does not reject legitimate pages that mention CDN vendors", () => {
  assert.equal(detectBlockedHtml('<html><body><article>Building character</article><script src="https://cloudflareinsights.com/beacon.min.js"></script></body></html>'), null);
  assert.equal(detectBlockedHtml('<html><body>Assets delivered by Akamai</body></html>'), null);
});

test("detects concrete challenge and denial signatures", () => {
  assert.equal(detectBlockedHtml('<html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget"></div></body></html>'), "cloudflare-block");
  assert.equal(detectBlockedHtml('Request unsuccessful. Incapsula incident ID: 123'), "incapsula-block");
  assert.equal(detectBlockedHtml('Access Denied. Reference #18.abcd.1234'), "akamai-block");
});
