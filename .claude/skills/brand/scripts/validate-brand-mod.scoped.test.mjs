import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

test('source-scoped style-only handoff does not require invented global tokens', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-scoped-mod-'));
  t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
  const original = JSON.parse(fs.readFileSync('public/brand-registry/v0.1/brands/onepiece-cardgame/0.1.0/brand-mod.json'));
  const run = mod => {
    const file = path.join(directory, 'brand-mod.json');
    fs.writeFileSync(file, JSON.stringify(mod));
    return spawnSync(process.execPath, [path.resolve('skills/brand/scripts/validate-brand-mod.mjs'), file], {encoding:'utf8'});
  };
  assert.equal(run(original).status, 0);
  const scoped = structuredClone(original);
  Object.assign(scoped.manifest.scope, {kind:'source-scoped-style-trial', completeBrandCertification:false, globalTokenPromotion:false, sourcePageIds:['source']});
  scoped.tokens = {mapped:{}, styleOnly:{'--style-local-fill':{value:'#123456'}}, dtcg:{localFill:{$type:'color', $value:'#123456', $extensions:{'echo.brand.target':'--style-local-fill', 'echo.brand.channel':'styleOnly', 'echo.brand.scope':'source primary control default only', 'echo.brand.evidenceRefs':['observed-primary']}}}};
  Object.assign(scoped.tokens.dtcg.localFill.$extensions, {'echo.brand.allowedRoles':['primary-action'], 'echo.brand.recipeId':scoped.componentVariants[0].id});
  scoped.semanticRoles = {};
  for (const key of ['surface.page','surface.card','text.primary','border.subtle','action.primary.fill']) scoped.semanticRoles[key] = {kind:'unresolvedEvidenceRole',target:null,value:null,status:'rejected',evidenceRefs:['observed-primary'],sources:['source'],reason:'A single source control does not prove a global semantic role.'};
  const accepted = run(scoped);
  assert.equal(accepted.status, 0, accepted.stderr);
  for (const mutate of [
    m => {m.manifest.scope.completeBrandCertification = true;},
    m => {m.tokens.mapped['--du-primary-color'] = {value:'#123456'};},
    m => {m.tokens.dtcg.localFill.$extensions['echo.brand.target'] = '--du-primary-color';},
    m => {m.tokens.dtcg.localFill.$extensions['echo.brand.evidenceRefs'] = [];},
    m => {m.semanticRoles['surface.page'].target = '--du-bg-2';},
    m => {m.semanticRoles['action.active.fill'] = {status:'mapped',target:'--du-primary-solid-bg',value:'#123456'};},
    m => {m.tokens.dtcg.localFill.$extensions['echo.brand.scope'] = 'global entire host UI';},
    m => {m.tokens.dtcg.localFill.$extensions['echo.brand.allowedRoles'] = ['surface.page'];},
    m => {m.tokens.dtcg.localFill.$extensions['echo.brand.recipeId'] = 'nonexistent';},
  ]) {
    const invalid = structuredClone(scoped); mutate(invalid);
    assert.notEqual(run(invalid).status, 0);
  }
});
