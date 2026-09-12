#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_PLATFORMS = new Set(["web", "taro-h5"]);
const INTERNAL_PLATFORMS = new Set(["web", "taro-h5", "weapp-developer-tool", "weapp-android", "weapp-ios"]);
const SENSITIVE_FLAGS = [
  "containsPrivateCode",
  "containsInternalUrl",
  "containsCredentials",
  "containsRawLogs",
  "containsPersonalData",
  "containsUnreviewedAssets",
];
const PUBLIC_FORBIDDEN_TEXT = [
  { code: "LOCAL_PATH", pattern: /(?:\/Users\/|[A-Za-z]:\\Users\\)/i },
  { code: "PRIVATE_NETWORK", pattern: /\b(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)\d{1,3}\.\d{1,3}/ },
  { code: "LOCAL_OR_INTERNAL_HOST", pattern: /(?:https?:\/\/)?(?:localhost|[^\s/]+\.(?:local|internal|corp))(?:[/:\s]|$)/i },
  { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/ },
  { code: "AWS_ACCESS_KEY", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
];

export function createTrialRecord({ channel, id, platform }) {
  if (!["internal", "public"].includes(channel)) throw new Error("--channel must be internal or public");
  return {
    schema: "brand-trial-record/v1",
    id,
    channel,
    platform: platform || (channel === "internal" ? "taro-h5" : "web"),
    sourceVisibility: channel === "internal" ? "private" : "public",
    feedbackDestination: channel === "internal" ? "internal-only" : "github-issue",
    networkSubmission: "disabled",
    metrics: {
      assistedInstall: null,
      timeToFirstVisibleResultMinutes: null,
      registryResult: "not-tested",
      businessSafety: "not-tested",
      rollback: "not-tested",
    },
    sensitiveContent: Object.fromEntries(SENSITIVE_FLAGS.map((key) => [key, false])),
    publicPromotion: { requested: false, sanitized: false, reviewed: false, authorized: false },
    notes: "",
  };
}

export function validateTrialRecord(record) {
  const errors = [];
  if (record?.schema !== "brand-trial-record/v1") errors.push("SCHEMA_INVALID");
  if (!record?.id || typeof record.id !== "string") errors.push("ID_MISSING");
  if (!["internal", "public"].includes(record?.channel)) errors.push("CHANNEL_INVALID");
  const supportedPlatforms = record?.channel === "public" ? PUBLIC_PLATFORMS : INTERNAL_PLATFORMS;
  if (!supportedPlatforms.has(record?.platform)) errors.push("PLATFORM_OUTSIDE_CHANNEL");
  if (record?.networkSubmission !== "disabled") errors.push("AUTOMATIC_NETWORK_SUBMISSION_FORBIDDEN");

  if (record?.channel === "public") {
    if (record.sourceVisibility !== "public") errors.push("PUBLIC_SOURCE_REQUIRED");
    if (record.feedbackDestination !== "github-issue") errors.push("PUBLIC_DESTINATION_INVALID");
    const textValues = collectStringValues(record);
    for (const { code, pattern } of PUBLIC_FORBIDDEN_TEXT) {
      if (textValues.some((value) => pattern.test(value))) errors.push(`PUBLIC_CONTENT_PATTERN:${code}`);
    }
  }
  if (record?.channel === "internal" && record.feedbackDestination !== "internal-only") {
    errors.push("INTERNAL_DESTINATION_INVALID");
  }

  for (const flag of SENSITIVE_FLAGS) {
    if (record?.sensitiveContent?.[flag] !== false) errors.push(`SENSITIVE_FLAG_NOT_CLEARED:${flag}`);
  }
  if (record?.publicPromotion?.requested) {
    for (const gate of ["sanitized", "reviewed", "authorized"]) {
      if (record.publicPromotion[gate] !== true) errors.push(`PUBLIC_PROMOTION_GATE_MISSING:${gate}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function collectStringValues(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStringValues);
  return [];
}

function parseArgs(argv) {
  const [command = "validate", ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) continue;
    flags[token.slice(2)] = rest[index + 1];
    index += 1;
  }
  return { command, flags };
}

function runCli() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "init") {
    const channel = flags.channel;
    const id = flags.id || `${channel || "trial"}-${new Date().toISOString().slice(0, 10)}`;
    const output = path.resolve(flags.out || `.brand-trials/${id}.json`);
    const record = createTrialRecord({ channel, id, platform: flags.platform });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, action: "initialized", channel, output }, null, 2));
    return;
  }
  if (command !== "validate" || !flags.record) {
    throw new Error("Usage: validate-trial-channel.mjs init --channel <internal|public> [--id <id>] [--platform <platform>] [--out <file>] | validate --record <file>");
  }
  const recordFile = path.resolve(flags.record);
  const result = validateTrialRecord(JSON.parse(fs.readFileSync(recordFile, "utf8")));
  console.log(JSON.stringify({ ...result, record: recordFile }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
