import fs from 'node:fs';
import crypto from 'node:crypto';
const [file,expected]=process.argv.slice(2);
const bytes=fs.readFileSync(file);
if(!/^[a-f0-9]{64}$/.test(expected||'') || crypto.createHash('sha256').update(bytes).digest('hex')!==expected) throw new Error('Frozen image arguments hash mismatch.');
const args=JSON.parse(bytes);
if(typeof args.prompt!=='string'||!Array.isArray(args.referenced_image_paths)) throw new Error('Invalid frozen image arguments.');
process.stdout.write(JSON.stringify(args));
