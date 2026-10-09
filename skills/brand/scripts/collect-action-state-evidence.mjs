#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] || fallback; };
const root = path.resolve(opt("--root", process.cwd()));
const url = opt("--source-url");
const pageId = opt("--page-id", "source");
const outDir = path.resolve(root, opt("--out-dir", `output/action-evidence/${pageId}`));
if (!url) { console.error("--source-url is required"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-US", colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });
  const candidates = await page.locator("a[href],button,[role=button],input[type=submit]").evaluateAll((nodes) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
    const text = (node.innerText || node.value || node.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
    return { index, text, visible: rect.width >= 60 && rect.height >= 28 && rect.top >= 0 && rect.bottom <= innerHeight && style.visibility !== "hidden" && style.display !== "none", area: rect.width * rect.height };
  }).filter(x => x.visible && x.text).sort((a,b)=>b.area-a.area).slice(0,3));
  const entries = [];
  const all = page.locator("a[href],button,[role=button],input[type=submit]");
  for (let order = 0; order < candidates.length; order += 1) {
    const candidate = candidates[order]; const locator = all.nth(candidate.index);
    const base = `${String(order + 1).padStart(2, "0")}-${candidate.text.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42) || "action"}`;
    const states = [];
    for (const state of ["default", "hover", "focus"]) {
      if (state === "hover") await locator.hover();
      if (state === "focus") await locator.focus();
      await page.waitForTimeout(180);
      const observation = await locator.evaluate((node, stateName) => {
        const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
        const selector = node.id ? `${node.tagName.toLowerCase()}#${CSS.escape(node.id)}` : `${node.tagName.toLowerCase()}${[...node.classList].slice(0,4).map(n=>`.${CSS.escape(n)}`).join("")}`;
        const rules=[]; for (const sheet of [...document.styleSheets]) { try { for (const rule of [...sheet.cssRules]) { if (rule.selectorText && node.matches(rule.selectorText)) rules.push({selector:rule.selectorText,cssText:rule.style.cssText,href:sheet.href||"inline"}); } } catch {} }
        const paint = (pseudo) => { const s=getComputedStyle(node,pseudo); return {content:s.content,backgroundColor:s.backgroundColor,backgroundImage:s.backgroundImage,color:s.color,borderColor:s.borderColor,borderRadius:s.borderRadius,boxShadow:s.boxShadow,opacity:s.opacity,transform:s.transform}; };
        return { state:stateName, selector, tag:node.tagName.toLowerCase(), className:String(node.className||""), text:(node.innerText||node.value||"").replace(/\s+/g," ").trim(), visibleRect:[rect.x,rect.y,rect.width,rect.height], computed:{backgroundColor:style.backgroundColor,backgroundImage:style.backgroundImage,color:style.color,borderColor:style.borderColor,borderRadius:style.borderRadius,boxShadow:style.boxShadow,fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,transform:style.transform},pseudo:{before:paint("::before"),after:paint("::after")},sourceRules:rules.slice(-8) };
      }, state);
      const capture = path.join(outDir, `${base}-${state}.png`); await page.screenshot({ path: capture });
      states.push({ ...observation, capture: path.relative(root, capture), captureSha256: sha256(capture) });
      if (state === "focus") await page.evaluate(() => document.activeElement?.blur());
    }
    entries.push({ id:`${pageId}-${base}`, sourceUrl:url, sourcePageId:pageId, semanticRole:order===0?"primary-action":"visible-action", states });
  }
  const output = path.join(outDir, "action-evidence.json");
  fs.writeFileSync(output, `${JSON.stringify({ schema:"brand-action-state-evidence/v1", pageId, sourceUrl:url, capturedAt:new Date().toISOString(), entries }, null, 2)}\n`);
  console.log(JSON.stringify({ ok:true, output:path.relative(root,output), entryCount:entries.length, statesPerEntry:3 }, null, 2));
} finally { await browser.close(); }
