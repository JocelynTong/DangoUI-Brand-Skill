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

const htmlValues = args.flatMap((value, index) => value === "--html" && args[index + 1] ? [args[index + 1]] : []);
const outputValues = args.flatMap((value, index) => value === "--output" && args[index + 1] ? [args[index + 1]] : []);
const captures = htmlValues.map((value, index) => ({ html: path.resolve(value), output: outputValues[index] ? path.resolve(outputValues[index]) : "" }));
const width = Number(option("--width", "1440"));
const height = Number(option("--height", "900"));
if (!captures.length || captures.length !== outputValues.length || captures.some(({ html, output }) => !output || !fs.existsSync(html))) {
  throw new Error("STATIC_H5_RENDER_INPUT_INVALID: each --html must exist and have a matching --output");
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

for (const { output } of captures) fs.mkdirSync(path.dirname(output), { recursive: true });
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
    "--remote-debugging-port=0",
    "--window-size=800,900",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const portFile = path.join(profile, "DevToolsActivePort");
  await waitFor(() => fs.existsSync(portFile), 8000, `Chrome DevTools did not start: ${stderr}`);
  const port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0];
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("STATIC_H5_RENDER_FAILED: no page target");
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: height });
    for (const { html, output } of captures) {
      const loaded = cdp.waitFor("Page.loadEventFired", 8000);
      await cdp.send("Page.navigate", { url: pathToFileURL(html).href });
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 800));
      const capture = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      fs.writeFileSync(output, Buffer.from(capture.data, "base64"));
    }
  } finally {
    cdp.close();
    child.kill("SIGTERM");
  }
  const results = captures.map(({ html, output }) => ({ html, output, bytes: fs.statSync(output).size, signature: fs.readFileSync(output).subarray(0, 8).toString("hex") }));
  if (results.some(({ signature }) => signature !== "89504e470d0a1a0a")) throw new Error("STATIC_H5_RENDER_FAILED: invalid PNG output");
  process.stdout.write(`${JSON.stringify({ ok: true, captures: results.map(({ signature, ...item }) => item), viewport: { width, height } })}\n`);
} finally {
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function waitFor(predicate, timeout, message) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started >= timeout) throw new Error(`STATIC_H5_RENDER_FAILED: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let id = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result || {});
      return;
    }
    const listeners = events.get(message.method) || [];
    events.delete(message.method);
    for (const listener of listeners) listener(message.params || {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    waitFor(method, timeout) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`STATIC_H5_RENDER_FAILED: ${method} timeout`)), timeout);
        const listener = (params) => { clearTimeout(timer); resolve(params); };
        events.set(method, [...(events.get(method) || []), listener]);
      });
    },
    close() { socket.close(); },
  };
}
