import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function runCachedValidator({ root, script, args = [] }) {
  const scriptFile = path.resolve(root, script);
  const inputFiles = args.filter((arg) => typeof arg === "string").map((arg) => path.resolve(root, arg)).filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  const fingerprint = { script, scriptSha256: sha(scriptFile), args, inputs: inputFiles.map((file) => ({ path: path.relative(root, file), sha256: sha(file) })) };
  const key = crypto.createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex");
  const cacheDir = path.join(root, ".brand-cache", "validator-results");
  const cacheFile = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(cacheFile)) return { ...JSON.parse(fs.readFileSync(cacheFile, "utf8")), cacheStatus: "hit", cacheKey: key };
  const result = spawnSync(process.execPath, [scriptFile, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const stored = { exitCode: result.status, stdout: result.stdout || "", stderr: result.stderr || "", fingerprint };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(stored, null, 2)}\n`);
  return { ...stored, cacheStatus: "miss", cacheKey: key };
}
function sha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
