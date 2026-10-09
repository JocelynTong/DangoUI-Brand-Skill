import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { ensureExtractorRuntime } from "./ensure-extractor-runtime.mjs";

const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "brand-installed-runtime-"));
try {
  const skill = path.join(isolated, "installed", "brand");
  const scripts = path.join(skill, "scripts");
  const artifacts = path.join(isolated, "artifacts");
  fs.mkdirSync(scripts, { recursive: true });
  fs.cpSync(path.resolve("skills/brand/runtime"), path.join(skill, "runtime"), { recursive: true });
  for (const file of ["ensure-extractor-runtime.mjs", "run-dembrandt-extractor.mjs", "resolve-browser-runtime.mjs"]) {
    fs.copyFileSync(path.resolve("skills/brand/scripts", file), path.join(scripts, file));
  }
  const skillUrl = pathToFileURL(path.join(scripts, "ensure-extractor-runtime.mjs")).href;
  let installs = 0;
  const runtime = ensureExtractorRuntime({ artifactRoot: artifacts, skillUrl, install(command, args, options) {
    installs += 1;
    assert.match(command, /^npm(?:\.cmd)?$/);
    assert.equal(args[0], "ci");
    assert.ok(args.includes("--ignore-scripts"));
    assert.ok(args.includes("--omit=optional"));
    assert.equal(options.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, "1");
    assert.ok(options.cwd.startsWith(path.join(artifacts, "output", ".brand-runtime")));
    // Offline installer fixture copies the real locked dependency closure,
    // rather than stubbing the CLI or generating candidate evidence.
    const lock = JSON.parse(fs.readFileSync(path.join(skill, "runtime/package-lock.json"), "utf8"));
    for (const [rel, entry] of Object.entries(lock.packages)) {
      if (!rel || entry.optional) continue;
      const target = path.join(options.cwd, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.resolve(rel), target, { recursive: true });
    }
    return { status: 0 };
  } });
  assert.equal(runtime.bootstrapped, true);
  assert.equal(runtime.version, "0.28.0");
  assert.match(runtime.lockSha256, /^[0-9a-f]{64}$/);
  assert.equal(runtime.browserDownloaded, false);
  assert.equal(runtime.installScriptsEnabled, false);
  assert.equal(installs, 1);
  const reused = ensureExtractorRuntime({ artifactRoot: artifacts, skillUrl, install() { throw new Error("Unexpected repeat installation"); } });
  assert.equal(reused.bootstrapped, false);
  const cli = spawnSync(process.execPath, [path.join(scripts, "run-dembrandt-extractor.mjs"), "--root", artifacts, "--brand", "runtime-only", "--source-url", "--version"], { encoding: "utf8", cwd: isolated });
  const payload = JSON.parse(cli.stdout);
  assert.notEqual(cli.status, 0); // --version is not extraction evidence.
  assert.match(payload.message, /non-JSON/);
  assert.match(payload.stdout, /0\.28\.0/);
  assert.equal(payload.extractorRuntime.runtimeKey, runtime.runtimeKey);
  assert.equal(fs.existsSync(payload.outputFile), false);
  const { resolveBrowserRuntime } = await import(pathToFileURL(path.join(scripts, "resolve-browser-runtime.mjs")).href);
  const browser = await resolveBrowserRuntime({ workspaceRoot: isolated, artifactRoot: artifacts });
  assert.equal(typeof browser.chromium.launch, "function");
  assert.ok(browser.modulePath.startsWith(fs.realpathSync(runtime.runtimeRoot)));
  assert.equal(fs.existsSync(path.join(isolated, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(skill, "node_modules")), false);
  assert.equal(fs.existsSync(path.join(artifacts, "node_modules")), false);
  assert.throws(() => ensureExtractorRuntime({ artifactRoot: path.join(isolated, "failed"), skillUrl, install() { return { status: 1, stderr: "registry unavailable" }; } }), error => error.code === "EXTRACTOR_RUNTIME_BOOTSTRAP_FAILED" && error.details === "registry unavailable");
  console.log("installed skill locked bootstrap, reuse, extractor CLI and shared browser runtime regression passed");
} finally {
  fs.rmSync(isolated, { recursive: true, force: true });
}
