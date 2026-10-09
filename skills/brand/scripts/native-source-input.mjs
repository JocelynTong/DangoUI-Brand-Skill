import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validInteractionEvidencePolicy } from './interaction-evidence-policy.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };

// Raw browser input is not an Evidence verdict. Keep its original bytes and
// limitations; the existing Researcher and downstream gates decide sufficiency.
export function validateNativeSourceInput({ file, brand, sourceUrl, filesDirectory = path.dirname(file) }) {
  const directory = fs.realpathSync(filesDirectory);
  const bytes = fs.readFileSync(file);
  const input = JSON.parse(bytes);
  if (input.schema !== 'brand-native-source-input/v1' || input.brand !== brand || input.sourceUrl !== sourceUrl || input.status !== 'raw-unreviewed' || !input.collector || !Number.isFinite(Date.parse(input.capturedAt)) || !Array.isArray(input.limitations) || !Array.isArray(input.files) || !input.files.length) fail('NATIVE_SOURCE_INPUT_INVALID');
  const paths = new Set();
  if (input.visualAuthority && input.visualAuthority !== 'viewport-sequence/v1') fail('NATIVE_SOURCE_VISUAL_AUTHORITY_INVALID');
  if (input.interactionEvidence !== undefined && (input.visualAuthority !== 'viewport-sequence/v1' || !validInteractionEvidencePolicy(input.interactionEvidence))) fail('NATIVE_SOURCE_INTERACTION_POLICY_INVALID');
  const files = input.files.map(ref => {
    if (!ref.path || path.isAbsolute(ref.path) || ref.path.includes('\\') || ref.path.split('/').some(part => !part || part === '.' || part === '..') || paths.has(ref.path)) fail('NATIVE_SOURCE_PATH_INVALID');
    paths.add(ref.path);
    const source = fs.realpathSync(path.resolve(directory, ref.path));
    if (!source.startsWith(directory + path.sep) || !fs.statSync(source).isFile()) fail('NATIVE_SOURCE_PATH_INVALID');
    const data = fs.readFileSync(source);
    if (!/^[a-f0-9]{64}$/.test(ref.sha256 || '') || hash(data) !== ref.sha256) fail('NATIVE_SOURCE_HASH_MISMATCH');
    if (['full-page-screenshot', 'viewport-screenshot'].includes(ref.role) && !(data.subarray(0,3).equals(Buffer.from([255,216,255])) || data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))) fail('NATIVE_SOURCE_SCREENSHOT_INVALID');
    return { ...ref, data };
  });
  if (!files.some(ref => ref.role === 'full-page-screenshot') || !files.some(ref => ref.role === 'browser-observation')) fail('NATIVE_SOURCE_REQUIRED_FILES_MISSING');
  if (input.visualAuthority && !files.some(ref => ref.role === 'viewport-screenshot')) fail('NATIVE_SOURCE_VIEWPORT_REQUIRED');
  return { input, bytes, files, sha256: hash(bytes) };
}

export function installNativeSourceInput({ file, root, brand, sourceUrl }) {
  const checked = validateNativeSourceInput({ file, brand, sourceUrl });
  const directory = path.join(root, 'migrations', brand, 'native-source-input');
  if (fs.existsSync(directory)) fail('NATIVE_SOURCE_INPUT_ALREADY_FROZEN');
  // Validate all bytes before writing; never overwrite another attempt.
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(directory), '.native-source-'));
  try {
    for (const ref of checked.files) {
      const destination = path.join(staging, 'files', ref.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, ref.data, { flag: 'wx' });
    }
    fs.writeFileSync(path.join(staging, 'input.json'), checked.bytes, { flag: 'wx' });
    fs.renameSync(staging, directory);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return readNativeSourceInput({ root, brand, sourceUrl });
}

export function readNativeSourceInput({ root, brand, sourceUrl }) {
  const directory = path.join(root, 'migrations', brand, 'native-source-input');
  const file = path.join(directory, 'input.json');
  if (!fs.existsSync(file)) return null;
  const { input, files, sha256 } = validateNativeSourceInput({ file, brand, sourceUrl, filesDirectory: path.join(directory, 'files') });
  const bindings = [{ path: path.relative(root, file), sha256 }];
  let sourceScreenshot;
  for (const ref of files) {
    const target = path.join(directory, 'files', ref.path);
    const binding = { path: path.relative(root, target), sha256: ref.sha256 };
    bindings.push(binding);
    if (ref.role === (input.visualAuthority ? 'viewport-screenshot' : 'full-page-screenshot') && !sourceScreenshot) sourceScreenshot = binding.path;
  }
  if (!sourceScreenshot) fail('NATIVE_SOURCE_REQUIRED_FILES_MISSING');
  return { bindings, sourceScreenshot, visualAuthority: input.visualAuthority, interactionEvidence: input.interactionEvidence, limitations: input.limitations };
}
