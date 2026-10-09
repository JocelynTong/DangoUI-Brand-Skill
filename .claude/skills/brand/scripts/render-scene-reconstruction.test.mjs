import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root=fs.mkdtempSync(path.join(os.tmpdir(),'scene-render-'))
for(const name of ['concept.png','empty.png','input.json'])fs.writeFileSync(path.join(root,name),name)
const art=(name)=>({path:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')})
const manifest={schema:'scene-reconstruction/v1',directionId:'a',viewport:{width:375,height:812},sceneCanvas:{width:300,height:240},conceptFrame:art('concept.png'),emptyScene:art('empty.png'),imagegenInput:art('input.json'),layers:{background:{source:'empty-scene'},dynamicContent:{source:'host-data'},foreground:{mode:'mask'},contactShadow:{model:'surface-aware'},environmentLight:{model:'scene-matched'}},slots:[{id:'one',businessBinding:'items[0]',z:1,quad:[[20,20],[100,25],[95,150],[22,148]],surface:'desk',occlusion:'rim',lightResponse:'left'}],productiveSurface:{hostBaselineSha256:'a'.repeat(64),coreEntry:'search',visibleResultFields:['title','author','tag']},coordinateAudit:{sameCoordinateSystem:true,recheckedAfterEmptyScene:true,method:'landmarks',maxDriftPx:2,anchors:[{id:'a',concept:[0,0],emptyScene:[0,0]},{id:'b',concept:[150,0],emptyScene:[150,1]},{id:'c',concept:[300,200],emptyScene:[299,200]}]},runtime:{assetRoot:root,backgroundUrl:'./empty.png',environmentLightCss:'radial-gradient(circle,#fff3,transparent)',groups:[{id:'A',objects:['a.png']},{id:'B',objects:['b.png']}]}}
const input=path.join(root,'manifest.json'),output=path.join(root,'out.html');fs.writeFileSync(input,JSON.stringify(manifest));execFileSync(process.execPath,[new URL('./render-scene-reconstruction.mjs',import.meta.url).pathname,input,output]);const html=fs.readFileSync(output,'utf8');for(const marker of ['matrix3d','scene-holes','contactShadowCss','environmentLightCss','dataset.slot'])assert.ok(html.includes(marker),marker);fs.rmSync(root,{recursive:true,force:true});console.log('render-scene-reconstruction tests passed')
