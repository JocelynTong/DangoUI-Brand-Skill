import fs from 'node:fs';

// Snapshot of the exposed Codex tool contract, not the separate Images API.
export const builtInImageCapability = Object.freeze({
  tool:'image_gen.imagegen', checkedAt:'2026-10-21',
  exposedParameters:['prompt','referenced_image_paths','num_last_images_to_include','transparent_background'],
  explicitSizeControl:false, maximumResolution:null, guaranteedMinimumResolution:null,
  evidence:'Current built-in tool schema; API size controls do not establish built-in capability.',
});
export const rasterDeliveryGuidance='Create a readable complete concept at the chosen viewport aspect ratio. Mobile width 1080 px and desktop width 1920 px are desired HD delivery thresholds, not guaranteed built-in tool capabilities. The current built-in tool exposes no size control or documented maximum; do not invent size arguments. Measure the actual output. A saved concept can be shown and selected below the HD threshold; report HD incomplete separately. Do not crop, upscale, regenerate or switch APIs automatically to claim compliance.';

// Read original raster headers, never CSS size or an upscaled derivative.
export function rasterDimensions(file) {
  const b=fs.readFileSync(file);
  if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
  if(b[0]===255&&b[1]===216) {
    let i=2;
    while(i+4<b.length) {
      if(b[i++]!==255)break;
      const marker=b[i++];if(marker===0xd9||marker===0xda)break;
      if(marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7)continue;
      const n=b.readUInt16BE(i);if(n<2||i+n>b.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&n>=7) return {width:b.readUInt16BE(i+5),height:b.readUInt16BE(i+3)};
      i+=n;
    }
  }
  if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP') {
    const type=b.toString('ascii',12,16);
    if(type==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
    if(type==='VP8 '&&b[23]===0x9d&&b[24]===1&&b[25]===0x2a)return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
    if(type==='VP8L'&&b[20]===0x2f)return {width:1+((b[21]|b[22]<<8)&0x3fff),height:1+((b[22]>>6|b[23]<<2|b[24]<<10)&0x3fff)};
  }
  return null;
}

export function imageResolution(file) {
  const size=rasterDimensions(file);
  const boundary={blocksSelection:false,blocksImplementation:false,automaticRegeneration:false,capability:builtInImageCapability,
    hdDelivery:{status:'not-verified',complete:false,reason:'Pixel dimensions alone do not verify readability, native provenance or asset suitability.'}};
  if(!size?.width||!size?.height)return {...boundary,status:'unknown',note:'预览与高清交付分开：原图尺寸未知，高清未核实；不因尺寸状态阻止选图，业务与来源核验仍有效。'};
  // Orientation is explicit here; it is not proof of host platform.
  const portrait=size.height>size.width,minimumWidth=portrait?1080:1920;
  const met=size.width>=minimumWidth;
  return {...boundary,...size,minimumWidth,basis:portrait?'portrait-width':'landscape-width',status:met?'target-met':'below-target',
    hdDelivery:{...boundary.hdDelivery,status:met?'pixel-threshold-met-needs-visual-check':'incomplete',reason:met?boundary.hdDelivery.reason:'Actual original width is below the HD delivery threshold.'},
    note:`预览已保存：${size.width} × ${size.height} px。${portrait?'竖版':'横版'}高清宽度目标 ≥ ${minimumWidth} px；${met?'像素门槛已满足，高清视觉质量尚未核实':'高清交付未完成'}。可继续选图落地，业务与来源限制不变；内置工具不保证指定尺寸，不自动放大、重画或切换 API。`};
}
