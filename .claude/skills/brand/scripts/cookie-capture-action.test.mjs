import test from 'node:test';
import assert from 'node:assert/strict';
import { rejectObservedCookieBanner } from './run-rendered-evidence-collector.mjs';

test('cookie rejection is explicit, uses visible UI and records both states', async () => {
  const events=[];
  const button={waitFor:async options=>events.push(options.state),innerText:async()=>'Reject All Cookies',click:async()=>events.push('click')};
  const page={locator:selector=>{assert.equal(selector,'#observed');return button;},screenshot:async options=>events.push(options.path.endsWith('cookie-before.png')?'before':'after')};
  assert.equal((await rejectObservedCookieBanner(page,{outDir:'/tmp'})).status,'not-requested');
  assert.deepEqual(events,[]);
  const result=await rejectObservedCookieBanner(page,{selector:'#observed',outDir:'/tmp'});
  assert.equal(result.status,'rejected-via-visible-button');
  assert.deepEqual(events,['visible','before','click','hidden','after']);
});

test('wrong labels and missing buttons fail without a click or fabricated success', async () => {
  for(const label of ['Accept All Cookies','Delete account','']) {
    const page={locator:()=>({waitFor:async()=>{},innerText:async()=>label,click:async()=>assert.fail('must not click')}),screenshot:async()=>assert.fail('must not capture success')};
    await assert.rejects(()=>rejectObservedCookieBanner(page,{selector:'#observed',outDir:'/tmp'}),/LABEL_MISMATCH/);
  }
  const page={locator:()=>({waitFor:async()=>{throw Error('not visible');}})};
  await assert.rejects(()=>rejectObservedCookieBanner(page,{selector:'#observed',outDir:'/tmp'}),/not visible/);
});
