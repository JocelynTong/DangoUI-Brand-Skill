// Pages keeps unchanged published packages; rebuilding one brand must not
// require the working evidence of every historical brand.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const registry = 'public/brand-previews/registry.json';
const current = JSON.parse(fs.readFileSync(registry, 'utf8'));
const base = process.env.REGISTRY_BASE_COMMIT || 'HEAD^';
const previous = JSON.parse(execFileSync('git', ['show', `${base}:${registry}`], {encoding:'utf8'}));
const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {encoding:'utf8'}).trim().split('\n');
const selected = current.brands.filter(brand => brand.publicationStatus === 'public-preview' && (
  JSON.stringify(brand) !== JSON.stringify(previous.brands.find(item => item.id === brand.id)) ||
  changed.some(file => file.startsWith(`${brand.migrationRoot}/`))
));
for (const brand of selected) {
  for (const script of ['build-public-brand-registry.mjs', 'validate-public-brand-registry-assets.mjs']) {
    execFileSync(process.execPath, [`scripts/${script}`, '--brand', brand.id], {stdio:'inherit'});
  }
}
console.log(`Pages registry: rebuilt ${selected.map(brand => brand.id).join(', ') || 'none; retaining published packages'}`);
