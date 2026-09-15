#!/usr/bin/env node
const scenario = process.env.SKILL_USAGE_TEST_SCENARIO;
const endpoint = process.argv[3] || "";
const isLookup = !process.argv.some(arg => arg.startsWith("title="));
if (process.argv.includes("state=closed")) { console.log(JSON.stringify({ number: 8, state: "closed" })); process.exit(0); }
if (scenario === "429" && !isLookup) { console.error("HTTP 429 rate limit"); process.exit(1); }
if (scenario === "500" && !isLookup) { console.error("HTTP 503 server error"); process.exit(1); }
if (scenario === "uncertain" && !isLookup) { process.kill(process.pid, "SIGTERM"); }
if (scenario === "existing" && isLookup) {
  const bodyArg = process.env.SKILL_USAGE_EXISTING_MARKER || "";
  console.log(JSON.stringify([{ number: 7, html_url: "https://example.invalid/issues/7", body: bodyArg }]));
} else if (isLookup) console.log("[]");
else console.log(JSON.stringify({ number: 8, html_url: `https://example.invalid/${endpoint}/8` }));
