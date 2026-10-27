import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const destination = process.argv[2] && path.resolve(process.argv[2]);
if (!destination || process.argv.length !== 3) throw Error('Usage: node prepare.mjs <new-empty-directory-outside-repository>');
if (fs.existsSync(destination) && (fs.lstatSync(destination).isSymbolicLink() || !fs.statSync(destination).isDirectory() || fs.readdirSync(destination).length)) throw Error('DESTINATION_MUST_BE_NEW_OR_EMPTY');
const args = [path.join(repo,'skills/brand/scripts/run-brand-workflow.mjs'), 'install-web-trial', '--mod-file', path.join(repo,'migrations/linjie-theme/runtime-only-distribution/brand-mod.json'), '--destination-root', destination, '--brand', 'linjie'];
const result = spawnSync(process.execPath, args, {encoding:'utf8'});
if (result.error) throw result.error;
if (result.status !== 0) { process.stderr.write(result.stderr || result.stdout); process.exit(result.status || 1); }
const receipt = JSON.parse(result.stdout);
for (const name of ['package.json','package-lock.json','index.html','src']) fs.cpSync(path.join(here,name),path.join(destination,name),{recursive:true,errorOnExist:true,force:false});
fs.writeFileSync(path.join(destination,'public-install-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:'prepared-not-runtime-validated', destination, command:[process.execPath,...args], receipt:'public-install-receipt.json', next:['npm ci --ignore-scripts --no-audit --no-fund','npm run build','npm run dev'], runtimeVerified:false, miniProgramVerified:false},null,2));
