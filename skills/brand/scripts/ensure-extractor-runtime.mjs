import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

// Runtime dependencies live with isolated artifacts, never in the host or
// installed skill tree (whose integrity hash must remain unchanged).
export function ensureExtractorRuntime({ artifactRoot, skillUrl = import.meta.url, install = spawnSync } = {}) {
  const manifestRoot = path.resolve(path.dirname(fileURLToPath(skillUrl)), "../runtime");
  const manifest = fs.readFileSync(path.join(manifestRoot, "package.json"));
  const lock = fs.readFileSync(path.join(manifestRoot, "package-lock.json"));
  const version = JSON.parse(manifest).dependencies.dembrandt;
  const lockSha256 = crypto.createHash("sha256").update(lock).digest("hex");
  const identity = crypto.createHash("sha256").update(manifest).update(lock).digest("hex").slice(0, 16);
  const runtimeRoot = path.join(path.resolve(artifactRoot), "output", ".brand-runtime", identity);
  const anchor = path.join(runtimeRoot, "package.json");
  const resolve = () => {
    const packageFile = path.join(runtimeRoot, "node_modules", "dembrandt", "package.json");
    const info = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    if (info.name !== "dembrandt" || info.version !== version) throw new Error("Extractor runtime version mismatch");
    const cli = typeof info.bin === "string" ? info.bin : info.bin?.dembrandt;
    const binary = path.resolve(path.dirname(packageFile), cli || "");
    if (!cli || !fs.existsSync(binary)) throw new Error("Extractor runtime CLI missing");
    if (!fs.realpathSync(binary).startsWith(`${fs.realpathSync(path.dirname(packageFile))}${path.sep}`)) throw new Error("Extractor CLI escapes its runtime package");
    const browserModulePath = createRequire(binary).resolve("playwright-core");
    if (!fs.realpathSync(browserModulePath).startsWith(`${fs.realpathSync(runtimeRoot)}${path.sep}node_modules${path.sep}`)) throw new Error("Browser module escapes the isolated runtime");
    return { runtimeRoot, binary, browserModulePath, version, lockSha256, runtimeKey: identity, browserDownloaded: false, installScriptsEnabled: false };
  };
  try { return { ...resolve(), bootstrapped: false }; } catch {}
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(anchor, manifest);
  fs.writeFileSync(path.join(runtimeRoot, "package-lock.json"), lock);
  const args = ["ci", "--ignore-scripts", "--omit=optional", "--no-audit", "--no-fund", "--cache", path.join(runtimeRoot, ".npm-cache"), "--fetch-retries=0", "--fetch-timeout=20000"];
  const result = install(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    cwd: runtimeRoot, encoding: "utf8", timeout: 90000,
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 || result.error) {
    throw Object.assign(new Error("Unable to initialize the locked extractor runtime in the isolated artifact directory."), {
      code: "EXTRACTOR_RUNTIME_BOOTSTRAP_FAILED", runtimeRoot,
      details: result.error?.message || result.stderr || result.stdout || `npm exited ${result.status}`,
    });
  }
  return { ...resolve(), bootstrapped: true };
}
