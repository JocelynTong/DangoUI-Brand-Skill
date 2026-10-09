import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { collectPngReferences, resolveEvidenceReference } from "./evidence-file-references.mjs";
import { selectedPosteditContext } from "./selected-h5-postedit-context.mjs";
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const fail = (code) => { throw new Error(code); };
const list = (value) => Array.isArray(value) ? value : [];
function bind(root, ref) {
  if (fs.existsSync(root) && fs.lstatSync(root).isSymbolicLink()) fail("SELECTED_H5_SYMLINK_FORBIDDEN");
  const file = path.resolve(root, ref?.path || "");
  if (!ref?.path || !file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !/^[a-f0-9]{64}$/.test(ref.sha256 || "")) fail("SELECTED_H5_INPUT_MISSING");
  for (let current = file; current !== root; current = path.dirname(current)) if (fs.lstatSync(current).isSymbolicLink()) fail("SELECTED_H5_SYMLINK_FORBIDDEN");
  if (!fs.statSync(file).isFile() || hash(file) !== ref.sha256) fail("SELECTED_H5_HASH_MISMATCH");
  return file;
}

export function validateSelectedH5Review({ root, brand, artifact, approval, qa, hostTarget, phase = "original", originalSnapshot, preeditBundle, priorStageId, completedStageId }) {
  root = path.resolve(root);
  if (!/^[\w-]+$/.test(brand || "")) fail("SELECTED_H5_BRAND_INVALID");
  const artifactFile = bind(root, artifact), approvalFile = bind(root, approval), qaFile = bind(root, qa);
  const approved = read(approvalFile), review = read(qaFile);
  if (approved.schema !== "brand-selected-h5-user-approval/v1" || approved.brand !== brand || approved.approvalSource !== "explicit-user" || !approved.userStatement?.trim() || approved.artifact?.path !== artifact.path || approved.artifact?.sha256 !== artifact.sha256 || approved.scope?.visualTargetAccepted !== true || approved.scope?.localHostImplementationAuthorized !== true || approved.scope?.preserveBusinessDataRoutesAndHandlers !== true || approved.scope?.sourceLearningCertified !== false || approved.scope?.publicDistributionAuthorized !== false) fail("SELECTED_H5_USER_APPROVAL_REQUIRED");
  if (review.schema !== "selected-h5-implementation-input-qa/v1" || review.verdict !== "pass" || review.scope !== "local-host-implementation-only" || review.fullWorkflowPass !== false || review.sourceLearningCertified !== false || review.publicDistributionAuthorized !== false || list(review.blockingFindings).length) fail("SELECTED_H5_IMPLEMENTATION_QA_REQUIRED");
  if (review.candidate?.path !== artifact.path || review.candidate?.sha256 !== artifact.sha256 || review.approval?.path !== approval.path || review.approval?.sha256 !== approval.sha256) fail("SELECTED_H5_REVIEW_BINDING_MISMATCH");
  const provenance = review.provenance;
  if (!provenance?.producerId?.startsWith("/root/") || !provenance?.reviewerId?.startsWith("/root/") || provenance.producerId === provenance.reviewerId || provenance.independent !== true) fail("SELECTED_H5_INDEPENDENT_QA_REQUIRED");
  const host = path.resolve(hostTarget || "");
  if (!path.isAbsolute(hostTarget || "") || path.resolve(approved.hostTarget || "") !== host || path.resolve(review.host?.root || "") !== host || !review.host?.route) fail("SELECTED_H5_HOST_MISMATCH");
  if (!["original", "postedit"].includes(phase) || phase === "original" && (originalSnapshot || preeditBundle)) fail("SELECTED_H5_HOST_PHASE_INVALID");
  if (phase === "postedit") validateSelectedH5OriginalSnapshot({ root, brand, originalSnapshot, preeditBundle, review, priorStageId, completedStageId });
  else bind(host, { path: review.host.source, sha256: review.host.sourceSha256 });
  bind(host, { path: review.host.appConfig, sha256: review.host.appConfigSha256 });
  if (review.host.styles && phase === "original") bind(host, { path: review.host.styles, sha256: review.host.stylesSha256 });
  if (phase === "postedit") for (const hostPath of [review.host.source,review.host.styles].filter(Boolean)) bind(host,{path:hostPath,sha256:hash(path.resolve(host,hostPath))}); // Check live containment/type/symlinks; the AST gate, not this hash, authorizes changes.
  if (["navigation", "peerGeometry", "businessProtection", "assetBoundaries"].some((key) => review.checks?.[key] !== "pass")) fail("SELECTED_H5_SCOPE_CHECKS_REQUIRED");
  if (!list(review.implementation?.scope?.apply).length || !list(review.implementation?.scope?.keep).length || !review.implementation?.protectedSemantics || !Object.values(review.implementation.protectedSemantics).some((value) => (typeof value === "string" && value.trim()) || (Array.isArray(value) && value.length && value.every(item => typeof item === "string" && item.trim())))) fail("SELECTED_H5_IMPLEMENTATION_SCOPE_REQUIRED");
  for (const ref of list(review.runtimeDependencies)) {
    if (ref.role !== "host-business-content" || !/^host-input\/(?:covers|avatars-v2|opcg\/covers|opcg\/avatars-v2)\/[\w./-]+\.(?:png|jpe?g|webp)$/i.test(ref.path || "") || ref.path.split("/").includes("..")) fail("SELECTED_H5_RUNTIME_DEPENDENCY_SCOPE_INVALID");
    bind(root, ref);
  }
  const refs = [artifact, approval, qa, ...list(review.inputs), ...list(review.assets), ...list(review.runtimeDependencies)];
  for (const ref of refs) bind(root, ref);
  for (const asset of list(review.assets)) if (asset.classification !== "case-specific-approved" || asset.officialIdentity !== false || asset.globalBrandApproval !== false) fail("SELECTED_H5_ASSET_SCOPE_INVALID");
  for (const name of ["brand-mod.json", "brand-evidence.json", "brand-intent.json", "host-startup-baseline.json"]) if (!refs.some((ref) => ref.path === `migrations/${brand}/${name}`)) fail(`SELECTED_H5_FROZEN_INPUT_REQUIRED:${name}`);
  return { approved, review, refs, artifactFile, root, host };
}

export function validateLocalSelectedMaster(root, brand, options = {}) {
  try {
    root = path.resolve(root);
    const prefix = `migrations/${brand}/`;
    const master = read(path.join(root, prefix, "approved-master.json"));
    if (master.permissionScope !== "local-host-implementation-only" || master.approvalScope !== "approved-implementation" || master.aestheticApproval !== "approved" || master.publicDistributionAuthorized !== false || master.sourceLearningCertified !== false) fail("SELECTED_H5_MASTER_SCOPE_INVALID");
    const valid = validateSelectedH5Review({ root, brand, artifact: master.artifact, approval: master.userApproval, qa: master.qa, hostTarget: master.navigationShellContract?.currentSourceBaseline?.hostRoot, phase: options.phase, originalSnapshot: options.originalSnapshot, preeditBundle: options.preeditBundle, priorStageId:options.priorStageId, completedStageId:options.completedStageId });
    const source = master.navigationShellContract.currentSourceBaseline;
    if (master.status !== "approved" || master.approvalSource !== "explicit-user" || JSON.stringify(master.implementationScope?.implementationScope) !== JSON.stringify(valid.review.implementation.scope) || JSON.stringify(master.implementationScope?.protectedSemantics) !== JSON.stringify(valid.review.implementation.protectedSemantics) || source.source !== valid.review.host.source || source.sha256 !== valid.review.host.sourceSha256 || source.route !== valid.review.host.route || source.appConfigSha256 !== valid.review.host.appConfigSha256) fail("SELECTED_H5_MASTER_REVIEW_MISMATCH");
    return { ok: true, master, review: valid.review, scope: "local-host-implementation-only", fullWorkflowPass: false };
  } catch (error) { return { ok: false, errors: [error.message] }; }
}

// This opt-in substitutes immutable ORIGINAL bytes only. It is not a structural
// or business-change verdict; receipt callers must retain their existing AST gate.
export function validateSelectedH5OriginalSnapshot({ root, brand, originalSnapshot, preeditBundle, review, priorStageId, completedStageId }) {
  root = path.resolve(root);
  const manifestFile = path.join(root, `migrations/${brand}/execution-manifest.json`);
  if (!fs.existsSync(manifestFile)) fail("SELECTED_H5_POSTEDIT_DISPATCH_BINDING_REQUIRED");
  const manifest = read(manifestFile), binding = manifest.selectedH5PosteditBinding;
  if (!binding || JSON.stringify(binding.originalSnapshot) !== JSON.stringify(originalSnapshot) || JSON.stringify(binding.preeditBundle) !== JSON.stringify(preeditBundle) || !/^[\w-]+$/.test(completedStageId || priorStageId || manifest.currentStageId || "")) fail("SELECTED_H5_POSTEDIT_DISPATCH_BINDING_REQUIRED");
  if (priorStageId || completedStageId) selectedPosteditContext(root,brand,{phase:"postedit",originalSnapshot,preeditBundle,priorStageId,completedStageId});
  const dispatchFile = path.join(root, `migrations/${brand}/dispatch/${completedStageId || priorStageId || manifest.currentStageId}.json`);
  if (!fs.existsSync(dispatchFile)) fail("SELECTED_H5_POSTEDIT_DISPATCH_BINDING_REQUIRED");
  const dispatch = read(dispatchFile);
  if (dispatch.stage !== "hostImplementation" || ![originalSnapshot, preeditBundle].every(ref => list(dispatch.requiredInputs).some(item => item.path === ref?.path && item.sha256 === ref?.sha256))) fail("SELECTED_H5_POSTEDIT_DISPATCH_BINDING_REQUIRED");
  const snapshot = read(bind(root, originalSnapshot));
  const masterPath = `migrations/${brand}/approved-master.json`;
  const masterFile = bind(root, snapshot.master), master = read(masterFile);
  if (snapshot.schema !== "selected-h5-original-snapshot/v1" || snapshot.phase !== "before-host-edit" || snapshot.capturedByRole !== "designDirectorOrchestrator" || snapshot.master?.path !== masterPath || JSON.stringify(snapshot.qa) !== JSON.stringify(master.qa) || JSON.stringify(snapshot.approval) !== JSON.stringify(master.userApproval) || snapshot.hostRoot !== path.resolve(review.host.root) || JSON.stringify(snapshot.preeditBundle) !== JSON.stringify(preeditBundle)) fail("SELECTED_H5_ORIGINAL_SNAPSHOT_BINDING_MISMATCH");
  bind(root, snapshot.qa); bind(root, snapshot.approval);
  const bundle = read(bind(root, preeditBundle));
  if (bundle.schema !== "brand-host-preedit-baseline-bundle/v1" || bundle.capturedByRole !== "designDirectorOrchestrator" || !list(bundle.entries).some(entry => path.resolve(entry.sourceFile || "") === path.resolve(snapshot.hostRoot, review.host.source) && entry.sourceSha256 === review.host.sourceSha256)) fail("SELECTED_H5_ORIGINAL_PREEDIT_BUNDLE_MISMATCH");
  const expected = [{ hostPath: review.host.source, sha256: review.host.sourceSha256 }, ...(review.host.styles ? [{ hostPath: review.host.styles, sha256: review.host.stylesSha256 }] : [])];
  if (list(snapshot.originals).length !== expected.length) fail("SELECTED_H5_ORIGINAL_FILES_MISMATCH");
  expected.forEach((item, index) => {
    const original = snapshot.originals[index];
    if (original.hostPath !== item.hostPath || original.sha256 !== item.sha256 || original.file?.sha256 !== item.sha256) fail("SELECTED_H5_ORIGINAL_FILES_MISMATCH");
    bind(root, original.file);
  });
  return { snapshot, master, originalSnapshot, preeditBundle };
}

export function captureSelectedH5OriginalSnapshot({ root, brand, preeditBundle, outputPath }) {
  root = path.resolve(root);
  const valid = validateLocalSelectedMaster(root, brand);
  if (!valid.ok) fail(valid.errors[0]);
  const masterPath = `migrations/${brand}/approved-master.json`, masterRef = { path: masterPath, sha256: hash(path.join(root, masterPath)) };
  const bundle = read(bind(root, preeditBundle)), review = valid.review, host = path.resolve(review.host.root);
  if (bundle.schema !== "brand-host-preedit-baseline-bundle/v1" || bundle.capturedByRole !== "designDirectorOrchestrator" || !list(bundle.entries).some(entry => path.resolve(entry.sourceFile || "") === path.resolve(host, review.host.source) && entry.sourceSha256 === review.host.sourceSha256)) fail("SELECTED_H5_ORIGINAL_PREEDIT_BUNDLE_MISMATCH");
  const relative = outputPath || `migrations/${brand}/selected-h5-originals/${masterRef.sha256.slice(0, 24)}/snapshot.json`;
  const output = path.resolve(root, relative);
  if (!output.startsWith(`${root}${path.sep}`) || fs.existsSync(output)) fail("SELECTED_H5_ORIGINAL_SNAPSHOT_OUTPUT_INVALID");
  for (let current = path.dirname(output); current !== root; current = path.dirname(current)) if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail("SELECTED_H5_SYMLINK_FORBIDDEN");
  const originals = [{ hostPath: review.host.source, sha256: review.host.sourceSha256 }, ...(review.host.styles ? [{ hostPath: review.host.styles, sha256: review.host.stylesSha256 }] : [])].map((item, i) => {
    const source = bind(host, { path: item.hostPath, sha256: item.sha256 });
    const dest = path.join(path.dirname(output), `original-${i}${path.extname(item.hostPath)}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL); fs.chmodSync(dest, 0o444);
    if (hash(dest) !== item.sha256) fail("SELECTED_H5_ORIGINAL_COPY_MISMATCH");
    return { ...item, file: { path: path.relative(root, dest), sha256: item.sha256 } };
  });
  const snapshot = { schema: "selected-h5-original-snapshot/v1", phase: "before-host-edit", capturedByRole: "designDirectorOrchestrator", capturedAt: new Date().toISOString(), hostRoot: host, master: masterRef, qa: valid.master.qa, approval: valid.master.userApproval, preeditBundle, originals };
  if (!validateLocalSelectedMaster(root, brand).ok || hash(path.join(root, masterPath)) !== masterRef.sha256) fail("SELECTED_H5_ORIGINAL_CAPTURE_DRIFT");
  fs.writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx", mode: 0o444 });
  return { path: path.relative(root, output), sha256: hash(output) };
}

export function freezeSelectedH5(options) {
  const { root, host, review, approved, refs } = validateSelectedH5Review(options);
  const brand = options.brand, prefix = `migrations/${brand}/`;
  const baseline = read(path.join(root, prefix, "host-startup-baseline.json"));
  const html = fs.readFileSync(path.join(root, options.artifact.path), "utf8");
  const treatment = html.match(/data-navigation-shell-treatment=["']([^"']+)["']/)?.[1];
  const continuity = html.match(/data-scene-continuity=["']([^"']+)["']/)?.[1];
  if (!baseline.navigationShellContract?.items?.length || !["native-preserved", "custom-contained", "custom-immersive"].includes(treatment) || !["continuous", "explicit-boundary"].includes(continuity)) fail("SELECTED_H5_NAVIGATION_CONTRACT_REQUIRED");
  const id = crypto.createHash("sha256").update(JSON.stringify({ artifact: options.artifact, approval: options.approval, qa: options.qa })).digest("hex").slice(0, 24);
  const directory = path.join(root, prefix, "selected-h5-handoffs", id);
  for (let current = path.dirname(directory); current !== root; current = path.dirname(current)) if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail("SELECTED_H5_SYMLINK_FORBIDDEN");
  if (fs.existsSync(directory)) fail("SELECTED_H5_HANDOFF_ALREADY_EXISTS");
  const build = path.join(directory, "build"), migration = path.join(build, prefix);
  const map = new Map(refs.map((ref) => [ref.path, ref]));
  const evidenceReferences = new Set();
  for (const name of ["brand-evidence.json", "brand-intent.json"]) collectPngReferences(read(bind(root, map.get(prefix + name))), evidenceReferences);
  for (const reference of evidenceReferences) {
    const file = resolveEvidenceReference(root, path.join(root, prefix), reference);
    const relative = file ? path.relative(root, file) : reference;
    if (!file || !file.startsWith(`${root}${path.sep}`) || !map.has(relative)) fail(`SELECTED_H5_EVIDENCE_DEPENDENCY_NOT_REVIEWED:${relative}`);
    bind(root, map.get(relative));
  }
  const copy = (relative, sha256) => { const src = bind(root, { path: relative, sha256 }); const dest = path.join(build, relative); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL); };
  // Static local dependencies are copied only when explicitly hash-bound by QA.
  const visited = new Set();
  const dependencies = (relative) => {
    if (visited.has(relative)) return; visited.add(relative);
    if (!/\.(?:html?|css)$/i.test(relative)) return;
    const text = fs.readFileSync(bind(root, map.get(relative)), "utf8");
    // JavaScript assignments are not markup attributes. Preserve script opening
    // tags (and their external src) but exclude script bodies from both scans.
    const cssFile = /\.css$/i.test(relative);
    const staticText = cssFile ? text : text.replace(/<!--[\s\S]*?-->/g, "").replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, "$1</script>");
    if (/<base\b/i.test(staticText)) fail("SELECTED_H5_BASE_URL_UNSUPPORTED");
    const markupTags = cssFile ? [] : [...staticText.matchAll(/<[a-z][^>]*>/gi)].map(match => match[0]);
    const urls = markupTags.flatMap(tag => [...tag.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/gi)].map((m) => m[1]));
    urls.push(...[...staticText.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1].trim()));
    for (const url of urls) {
      if (/^(?:https?:|data:|#|\/\/)/i.test(url) || /\$\{|["']\s*\+/.test(url)) continue;
      const file = url.startsWith("/") ? path.resolve(root, `.${url.split(/[?#]/)[0]}`) : path.resolve(root, path.dirname(relative), url.split(/[?#]/)[0]);
      const dependency = path.relative(root, file);
      if (!map.has(dependency)) fail(`SELECTED_H5_DEPENDENCY_NOT_REVIEWED:${dependency}`);
      dependencies(dependency);
    }
  };
  dependencies(options.artifact.path);
  for (const ref of map.values()) bind(root, ref);
  fs.mkdirSync(migration, { recursive: true });
  for (const ref of map.values()) copy(ref.path, ref.sha256);
  const write = (name, value) => fs.writeFileSync(path.join(migration, name), `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  const baselineRef = map.get(prefix + "host-startup-baseline.json");
  const business = { schema: "business-scope/v1", primaryTask: baseline.primaryTask, informationDistributionContract: baseline.informationDistributionContract, protectedSemantics: review.implementation.protectedSemantics, userApproval: options.approval };
  write("business-scope.json", business);
  const frozenInputs = { brandMod: map.get(prefix + "brand-mod.json"), brandEvidence: map.get(prefix + "brand-evidence.json"), businessScope: { path: prefix + "business-scope.json", sha256: hash(path.join(migration, "business-scope.json")) } };
  const handoff = { schema: "selected-h5-local-handoff/v1", scope: review.implementation.scope, reviewedConstraints: review.implementation.scope, targetRoute: review.host.route, protectedSemantics: review.implementation.protectedSemantics, hostRoot: host, targetSource: review.host.source, permissionScope: review.scope };
  write("implementation-handoff.json", handoff);
  const handoffRef = { path: prefix + "implementation-handoff.json", sha256: hash(path.join(migration, "implementation-handoff.json")) };
  const master = { schema: "brand-approved-master/v1", brand, status: "approved", approvalSource: "explicit-user", approvalScope: "approved-implementation", aestheticApproval: "approved", permissionScope: review.scope, publicDistributionAuthorized: false, sourceLearningCertified: false, artifact: options.artifact, userApproval: options.approval, qa: options.qa, implementationAuthority: "artifact-and-qa", implementationScope: { implementationScope: review.implementation.scope, protectedSemantics: review.implementation.protectedSemantics, handoff: handoffRef }, navigationShellContract: { baseline: baselineRef, currentSourceBaseline: { hostRoot: host, source: review.host.source, sha256: review.host.sourceSha256, route: review.host.route, appConfigSha256: review.host.appConfigSha256 }, itemIds: baseline.navigationShellContract.items.map((item) => item.id), treatment, sceneContinuity: continuity } };
  write("approved-master.json", master);
  write("design-direction.json", { schema: "design-direction/v1", status: "frozen", implementationAuthority: "approved-master-artifact", previewArtifact: options.artifact, frozenInputs, approvedMaster: { qaSha256: options.qa.sha256 }, selectedOptionId: "selected-exact-h5", userApproval: options.approval });
  write("design-direction-decision.json", { status: "selected", selectionSource: "explicit-user", selectedOptionIds: ["selected-exact-h5"], userApproval: options.approval });
  write("brand-application-plan.json", { schema: "brand-application-plan/v1", approvedMaster: options.artifact, activeRevisionScope: review.implementation.scope, implementationAuthority: "approved-master-artifact" });
  write("design-direction-options.json", { schema: "selected-h5-local-options/v1", selectedMaster: { path: prefix + "approved-master.json", sha256: hash(path.join(migration, "approved-master.json")) } });
  const masterRef = { path: prefix + "approved-master.json", sha256: hash(path.join(migration, "approved-master.json")) };
  write("design-host-route.json", { schema: "design-host-route/v3", sequence: "h5-design-system-first", localSelectedMaster: masterRef, sourceLearningCertified: false, publicDistributionAuthorized: false });
  fs.writeFileSync(path.join(directory, "run.json"), JSON.stringify({ schema: "brand-artifact-run/v1", status: "active", host, reason: "Apply the exact user-approved H5 locally; prior exploration remains unchanged" }));
  return { ok: true, status: "handoff-frozen", dispatchReady: false, artifactRoot: build, approvedMaster: masterRef, scope: review.scope, fullWorkflowPass: false, nextAction: "Run the existing apply-host input gates. Complete legitimate TPP/action evidence and independently seal a fresh apply-host Goal before standard prepare/next Host Strategy dispatch; this freeze is not host implementation or runtime PASS.", nextCommand: ["run", "--request-kind", "host-implementation", "--mode", "apply-host", "--artifact-root", build, "--brand", brand, "--host-target", host, "--mod-file", path.join(build, prefix, "brand-mod.json")] };
}
