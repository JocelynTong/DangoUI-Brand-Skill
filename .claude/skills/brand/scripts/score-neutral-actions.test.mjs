import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "brand-guard.mjs");

test("cross-page neutral actions are evidence, not an approved primary token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brand-neutral-actions-"));
  try {
    const file = path.join(root, "review.json");
    fs.writeFileSync(file, JSON.stringify({
      schema: "brand-primary-role-frequency-review/v1",
      status: "candidate-not-approved",
      sources: [
        { pageId: "home", url: "https://example.com/", styles: [{ role: "content discovery", count: 6, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
        { pageId: "learn", url: "https://example.com/learn", styles: [{ role: "tutorial discovery", count: 7, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
        { pageId: "product", url: "https://example.com/product", styles: [{ role: "product discovery", count: 7, background: "rgb(0, 0, 0)", foreground: "rgb(255, 255, 255)" }] },
      ],
    }));
    const run = spawnSync(process.execPath, [script, "score-action-evidence", "--brand", "example", "--root", root, "--file", "review.json", "--out", "score.json"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const scored = JSON.parse(fs.readFileSync(path.join(root, "score.json"), "utf8"));
    assert.equal(scored.gate.ok, true);
    assert.equal(scored.candidates.neutralActionSurface[0].hex, "#000000");
    assert.equal(scored.candidates.neutralActionSurface[0].score, 24);
    assert.deepEqual(scored.candidates.primaryActionFill, []);
    assert.equal(scored.promotionStatus, "candidate-not-approved");
    assert.equal(scored.evidenceScope, "sampled-content-actions-only");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
