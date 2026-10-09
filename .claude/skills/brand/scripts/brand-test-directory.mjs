import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cleanup owns only the exact directory created here. It never accepts a target
// computed by a caller (especially dirname(tmp) after a fixture changes shape).
export function createBrandTestDirectory(label = 'run') {
  if (!/^[a-z0-9-]{1,60}$/.test(label)) throw new Error('TEST_DIRECTORY_LABEL_INVALID');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `brand-test-${label}-`));
  const identity = fs.lstatSync(directory);
  const realDirectory = fs.realpathSync(directory);
  return Object.freeze({
    directory,
    cleanup() {
      if (!fs.existsSync(directory)) return false;
      const current = fs.lstatSync(directory);
      if (current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino || fs.realpathSync(directory) !== realDirectory) throw new Error('TEST_DIRECTORY_IDENTITY_CHANGED');
      fs.rmSync(directory, { recursive: true, force: true });
      return true;
    },
  });
}
