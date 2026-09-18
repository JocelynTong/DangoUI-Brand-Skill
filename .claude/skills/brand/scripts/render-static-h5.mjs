#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const html = path.resolve(option("--html"));
const output = path.resolve(option("--output"));
const width = Number(option("--width", "1440"));
const height = Number(option("--height", "900"));
if (!option("--html") || !option("--output") || !fs.existsSync(html)) {
  throw new Error("STATIC_H5_RENDER_INPUT_INVALID: --html must exist and --output is required");
}
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 200 || height < 200) {
  throw new Error("STATIC_H5_RENDER_VIEWPORT_INVALID");
}

const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const chrome = candidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) throw new Error("STATIC_H5_RENDER_CHROME_MISSING");

fs.mkdirSync(path.dirname(output), { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "brand-h5-render-"));
try {
  const child = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "--virtual-time-budget=3000",
    `--screenshot=${output}`,
    pathToFileURL(html).href,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = setInterval(() => {
      if (fs.existsSync(output) && fs.statSync(output).size > 8) {
        const signature = fs.readFileSync(output).subarray(0, 8).toString("hex");
        if (signature === "89504e470d0a1a0a") {
          clearInterval(poll);
          child.kill("SIGTERM");
          resolve();
          return;
        }
      }
      if (Date.now() - started >= 15000) {
        clearInterval(poll);
        child.kill("SIGKILL");
        reject(new Error(`STATIC_H5_RENDER_FAILED: ${stderr || "capture timeout"}`));
      }
    }, 100);
    child.once("error", (error) => {
      clearInterval(poll);
      reject(new Error(`STATIC_H5_RENDER_FAILED: ${error.message}`));
    });
  });
  process.stdout.write(`${JSON.stringify({ ok: true, html, output, viewport: { width, height }, bytes: fs.statSync(output).size })}\n`);
} finally {
  fs.rmSync(profile, { recursive: true, force: true });
}
