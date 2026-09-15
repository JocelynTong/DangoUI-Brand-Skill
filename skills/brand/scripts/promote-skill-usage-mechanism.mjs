#!/usr/bin/env node
import path from "node:path";
import { fail, parseArgs, readJson, writeJson } from "./skill-usage-case-lib.mjs";
const args = parseArgs(process.argv.slice(2));
if (!args.aggregate || !args.fingerprint || !args.output) fail("AGGREGATE_FINGERPRINT_OUTPUT_REQUIRED");
const mechanism = readJson(path.resolve(args.aggregate)).mechanisms?.find(item => item.fingerprint === args.fingerprint);
if (!mechanism) fail("MECHANISM_NOT_FOUND");
const expedited = ["safety", "data-loss", "permission", "contract"].includes(String(args.category));
if (mechanism.independentCaseCount < 2 && !expedited) fail("PROMOTION_REQUIRES_TWO_INDEPENDENT_CASES");
if (!args["stable-reproduction"] || !args["executable-gate"] || !args["false-positive-reviewed"] || !args["maintainer-approved"]) fail("PROMOTION_CRITERIA_INCOMPLETE");
const decision = { ...mechanism, lifecycle: "validated-common", expedited, stableReproduction: true, executableGate: true, falsePositiveReviewed: true, maintainerApproved: true, promotedAt: new Date().toISOString() };
writeJson(path.resolve(args.output), decision);
console.log(JSON.stringify({ status: "VALIDATED_COMMON", fingerprint: mechanism.fingerprint, expedited }, null, 2));
