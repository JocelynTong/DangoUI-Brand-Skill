import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");
const fail = (code) => { throw new Error(code); };

export function recoverReference({ root, brand, sourceRoot, sourceMaster, sourceMasterSha256, reason, confirmed = false }) {
  if (!confirmed || !String(reason || "").trim()) fail("REFERENCE_EXPLICIT_CONFIRMATION_REQUIRED");
  if (!path.isAbsolute(root || "") || !path.isAbsolute(sourceRoot || "") || !brand || !/^[\w-]+$/.test(brand)) fail("REFERENCE_ROOT_INVALID");
  root = path.resolve(root);
  sourceRoot = path.resolve(sourceRoot);
  const files = new Map();
  const remoteResources = new Set();
  const safeFile = (relative) => {
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) fail("REFERENCE_PATH_UNSAFE");
    const file = path.resolve(sourceRoot, relative);
    if (!file.startsWith(`${sourceRoot}${path.sep}`) || !fs.existsSync(file)) fail(`REFERENCE_DEPENDENCY_MISSING:${relative}`);
    for (let current = file; ; current = path.dirname(current)) {
      if (fs.lstatSync(current).isSymbolicLink()) fail("REFERENCE_SYMLINK_FORBIDDEN");
      if (current === sourceRoot) break;
    }
    if (!fs.statSync(file).isFile()) fail("REFERENCE_FILE_REQUIRED");
    return file;
  };
  const add = (relative, expected = "") => {
    const file = safeFile(relative);
    const sha256 = hash(file);
    if (expected && (!/^[a-f0-9]{64}$/.test(expected) || sha256 !== expected)) fail("REFERENCE_HASH_MISMATCH");
    if (!files.has(relative)) files.set(relative, { path: relative, file, sha256 });
    if (files.size > 128 || [...files.values()].reduce((sum, item) => sum + fs.statSync(item.file).size, 0) > 52428800) fail("REFERENCE_RECOVERY_SIZE_LIMIT");
    return file;
  };
  if (!/^[a-f0-9]{64}$/.test(sourceMasterSha256 || "")) fail("REFERENCE_MASTER_HASH_REQUIRED");
  const masterFile = add(sourceMaster, sourceMasterSha256);
  const master = JSON.parse(fs.readFileSync(masterFile, "utf8"));
  if (master.schema !== "brand-approved-master/v1" || !master.artifact?.path || !master.artifact?.sha256) fail("REFERENCE_MASTER_INVALID");
  const verifyBindings = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.path && value.sha256) add(value.path, value.sha256);
    for (const item of Object.values(value)) if (item && typeof item === "object") verifyBindings(item);
  };
  verifyBindings(master);
  const scanned = new Set();
  const scan = (relative) => {
    if (scanned.has(relative)) return;
    scanned.add(relative);
    const file = add(relative);
    if (!/\.(?:html?|css)$/i.test(file)) return;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/https?:\/\/[^"'`\s<>]+/g)) remoteResources.add(match[0]);
    if (/<base\b/i.test(text)) fail("REFERENCE_BASE_URL_UNSUPPORTED");
    const refs = [...text.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    refs.push(...[...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1].trim()));
    refs.push(...[...text.matchAll(/@import\s+["']([^"']+)["']/gi)].map((m) => m[1]));
    for (const srcset of text.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) refs.push(...srcset[1].split(",").map((item) => item.trim().split(/\s+/)[0]));
    for (const ref of refs) {
      if (/^(?:https?:)?\/\//i.test(ref)) { remoteResources.add(ref); continue; }
      if (/^(?:data:|#)/i.test(ref) || /\$\{|["']\s*\+|^\+/.test(ref)) continue;
      if (/^[a-z][\w+.-]*:/i.test(ref)) fail("REFERENCE_RESOURCE_SCHEME_UNSUPPORTED");
      const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
      if (!clean) continue;
      const resolved = clean.startsWith("/") ? path.resolve(sourceRoot, `.${clean}`) : path.resolve(path.dirname(file), clean);
      if (!resolved.startsWith(`${sourceRoot}${path.sep}`)) fail("REFERENCE_PATH_UNSAFE");
      scan(path.relative(sourceRoot, resolved));
    }
  };
  // Historical superseded HTML is evidence, not an additional runtime target.
  // Verify its bound bytes above; require runtime dependencies only for the
  // exact reference the user selected and its transitive static imports.
  scan(master.artifact.path);
  const fileList = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const contentId = digest(JSON.stringify({ sourceMasterSha256, files: fileList.map(({ path, sha256 }) => ({ path, sha256 })) })).slice(0, 24);
  const migration = path.join(root, "migrations", brand);
  const destination = path.join(migration, "recovered-references", contentId);
  const recordFile = path.join(destination, "recovery.json");
  const indexFile = path.join(migration, "prior-direction-index.json");
  let index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : { schema: "brand-prior-directions/v1" };
  for (let current = path.dirname(destination); current !== root; current = path.dirname(current)) if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail("REFERENCE_DESTINATION_SYMLINK_FORBIDDEN");
  if (fs.lstatSync(root).isSymbolicLink() || (fs.existsSync(indexFile) && fs.lstatSync(indexFile).isSymbolicLink())) fail("REFERENCE_DESTINATION_SYMLINK_FORBIDDEN");
  if (fs.existsSync(destination)) {
    if (fs.lstatSync(destination).isSymbolicLink() || !fs.existsSync(recordFile)) fail("REFERENCE_DESTINATION_CONFLICT");
    const record = JSON.parse(fs.readFileSync(recordFile, "utf8"));
    const indexed = (index.recoveredReferences || []).find((item) => item.contentId === contentId);
    if (record.schema !== "brand-reference-recovery/v1" || record.contentId !== contentId || record.sourceMaster.sha256 !== sourceMasterSha256 || record.scope !== "historical-visual-reference-only" || record.applyHostApproved !== false || !indexed || indexed.reference?.sha256 !== hash(recordFile)) fail("REFERENCE_DESTINATION_CONFLICT");
    for (const binding of record.files) {
      const file = path.resolve(root, binding.path);
      if (!file.startsWith(`${destination}${path.sep}`)) fail("REFERENCE_RECOVERED_PATH_UNSAFE");
      for (let current = file; current !== root; current = path.dirname(current)) if (fs.lstatSync(current).isSymbolicLink()) fail("REFERENCE_DESTINATION_SYMLINK_FORBIDDEN");
      if (hash(file) !== binding.sha256) fail("REFERENCE_RECOVERED_HASH_MISMATCH");
    }
    return { ok: true, idempotent: true, reference: { path: path.relative(root, recordFile), sha256: hash(recordFile) }, artifact: record.artifact, scope: record.scope };
  }
  fs.mkdirSync(destination, { recursive: true });
  const copied = fileList.map((binding) => {
    const target = path.join(destination, "files", binding.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(binding.file, target, fs.constants.COPYFILE_EXCL);
    return { sourcePath: binding.path, path: path.relative(root, target), sha256: binding.sha256 };
  });
  const record = { schema: "brand-reference-recovery/v1", contentId, brand, reason, scope: "historical-visual-reference-only", hostMutationAllowed: false, learningComplete: false, applyHostApproved: false, aestheticApproval: master.aestheticApproval || "unavailable", sourceMaster: { root: sourceRoot, path: sourceMaster, sha256: sourceMasterSha256 }, preservedApprovalScope: master.approvalScope || null, artifact: copied.find((item) => item.sourcePath === master.artifact.path), files: copied, remoteResources: [...remoteResources], remoteDataPolicy: "Historical frozen references, not fresh API data; remote resources were not downloaded or verified as current.", limitations: ["No workflow, learning, aesthetic or host implementation approval inferred from recovery.", "Reference geometry and diagnostic business records are not implementation authority.", "Superseded HTML is hash-verified history only; its obsolete runtime dependencies are not recovered or certified."] };
  fs.writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  const reference = { path: path.relative(root, recordFile), sha256: hash(recordFile) };
  index.recoveredReferences ||= [];
  index.recoveredReferences.push({ contentId, reference, scope: record.scope, aestheticApproval: record.aestheticApproval, artifact: record.artifact });
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  return { ok: true, idempotent: false, reference, artifact: record.artifact, scope: record.scope };
}
