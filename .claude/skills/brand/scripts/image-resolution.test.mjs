import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {imageResolution} from './image-resolution.mjs';
test('native pixel target is separate from availability and review',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pixel-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'image.png');
  for(const [width,height,status] of [[1080,2340,'target-met'],[1024,1536,'below-target'],[1586,992,'below-target'],[1920,1200,'target-met']]){
    const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);fs.writeFileSync(file,b);
    assert.equal(imageResolution(file).status,status);assert.equal(imageResolution(file).width,width);
  }
});
