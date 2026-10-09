import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fail = (code) => { throw new Error(code); };
const list = (value) => Array.isArray(value) ? value : [];
const eligible = new Set(["permitted-bounded-candidate", "permitted-reference-only", "permitted-conditional-candidate"]);

export function validateTransferReview({ file, sha256, brand, producers = [] }) {
  if (!path.isAbsolute(file || "") || !/^[a-f0-9]{64}$/.test(sha256 || "") || hash(file) !== sha256) fail("TRANSFER_REVIEW_HASH_INVALID");
  const review = read(file);
  if (review.schema !== "source-system-transfer/v1" || review.brand !== brand || review.status !== "independently-reviewed-bounded-candidate" || !review.scope || review.consumption?.automatic !== false || review.preservation?.fullCertificationGranted !== false || review.preservation?.hostImplementationApproved !== false) fail("TRANSFER_REVIEW_SCOPE_INVALID");
  const reviewer = review.reviewer?.identity;
  if (!reviewer?.startsWith("/root/") || review.reviewer?.independentOfEvidenceProducer !== true || review.reviewer?.independentOfH5Producer !== true || producers.includes(reviewer)) fail("TRANSFER_REVIEW_INDEPENDENCE_INVALID");
  const directory = fs.realpathSync(path.dirname(file));
  const inputs = list(review.reviewInputs).map((binding) => {
    if (!binding.path || path.isAbsolute(binding.path) || binding.path.split(/[\\/]/).includes("..")) fail("TRANSFER_INPUT_PATH_UNSAFE");
    const source = path.resolve(directory, binding.path);
    const actual = fs.realpathSync(source);
    if (!actual.startsWith(`${directory}${path.sep}`) || !fs.statSync(actual).isFile() || !/^[a-f0-9]{64}$/.test(binding.sha256 || "") || hash(actual) !== binding.sha256) fail("TRANSFER_INPUT_HASH_INVALID");
    return { ...binding, source: actual };
  });
  const packetInput = inputs.find((item) => path.basename(item.path) === "evidence-packet.json");
  if (!packetInput || inputs.length < 2 || new Set(inputs.map((item) => item.path)).size !== inputs.length) fail("TRANSFER_EVIDENCE_PACKET_REQUIRED");
  const packet = read(packetInput.source);
  const evidenceProducer = packet.producerExecutionId || packet.agentExecutionId || packet.producer?.identity;
  if (evidenceProducer === reviewer) fail("TRANSFER_REVIEW_INDEPENDENCE_INVALID");
  const observed = new Set(list(packet.claims).filter((item) => item.status === "observed").map((item) => item.id));
  const rules = list(review.rules);
  const permitted = list(review.permittedRuleIds);
  if (!permitted.length || new Set(rules.map((item) => item.id)).size !== rules.length || permitted.some((id) => !rules.some((rule) => rule.id === id && eligible.has(rule.status) && rule.scope && list(rule.notFor).length && list(rule.evidenceRefs).length && rule.evidenceRefs.every((ref) => observed.has(ref)))) || list(review.excludedRuleIds).some((id) => permitted.includes(id) || !rules.some((rule) => rule.id === id && rule.status === "excluded"))) fail("TRANSFER_RULES_INVALID");
  return { review, inputs };
}

export function installTransferReview({ file, sha256, root, brand, stageId, producers }) {
  const validated = validateTransferReview({ file, sha256, brand, producers });
  const directory = path.join(root, "migrations", brand, "source-transfer-inputs", stageId);
  if (fs.existsSync(directory)) fail("TRANSFER_INPUT_ALREADY_FROZEN");
  fs.mkdirSync(directory, { recursive: true });
  const bindings = [];
  for (const input of [{ path: "transfer-reviewed.json", source: file, sha256 }, ...validated.inputs]) {
    const destination = path.join(directory, input.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(input.source, destination, fs.constants.COPYFILE_EXCL);
    bindings.push({ path: path.relative(root, destination), sha256: input.sha256 });
  }
  return { review: bindings[0], inputs: bindings, permittedRuleIds: validated.review.permittedRuleIds, excludedRuleIds: validated.review.excludedRuleIds, scope: validated.review.scope, rules: validated.review.rules, approvalLevel: "candidate-mechanisms-for-isolated-trial-only" };
}

export function validateTransferApplications({ metadata, source, review, reviewSha256, producerExecutionId, assets = [] }) {
  if (review.reviewer.identity === producerExecutionId) fail("TRANSFER_REVIEW_INDEPENDENCE_INVALID");
  const applications = list(metadata.transferRuleApplications);
  if (!applications.length) fail("TRANSFER_RULE_APPLICATION_REQUIRED");
  for (const application of applications) {
    const rule = review.rules.find((item) => item.id === application.ruleId);
    if (!review.permittedRuleIds.includes(application.ruleId) || !rule || !eligible.has(rule.status)) fail("TRANSFER_RULE_UNKNOWN_OR_EXCLUDED");
    if (application.sourceReviewSha256 !== reviewSha256 || application.ruleScope !== rule.scope || !application.region || String(application.hostReason || "").trim().length < 12 || !list(application.evidenceRefs).length || application.evidenceRefs.some((ref) => !rule.evidenceRefs.includes(ref))) fail("TRANSFER_APPLICATION_BINDING_INVALID");
    const selector = String(application.selector || "");
    const id = selector.match(/^#([A-Za-z][\w-]*)$/)?.[1];
    const region = selector.match(/^\[data-transfer-region="([\w-]+)"\]$/)?.[1];
    if ((!id && !region) || (id && !new RegExp(`\\bid=["']${id}["']`).test(source)) || (region && !source.includes(`data-transfer-region="${region}"`))) fail("TRANSFER_APPLICATION_SELECTOR_MISSING");
    if (rule.status === "permitted-reference-only" && application.usage !== "reference-only") fail("TRANSFER_REFERENCE_ONLY_REQUIRED");
    if (rule.status === "permitted-conditional-candidate" && !assets.some((asset) => asset.id === application.assetRef)) fail("TRANSFER_CONDITIONAL_ASSET_REQUIRED");
  }
  return applications;
}
