import fs from 'node:fs';

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
  if(!size?.width||!size?.height)return {status:'unknown',note:'原图尺寸未能识别，不代表达到高清目标。'};
  // Orientation is explicit here; it is not proof of host platform.
  const portrait=size.height>size.width,minimumWidth=portrait?1080:1920;
  return {...size,minimumWidth,basis:portrait?'portrait-width':'landscape-width',status:size.width>=minimumWidth?'target-met':'below-target',
    note:`原图 ${size.width} × ${size.height} px；${portrait?'竖版':'横版'}宽度目标 ≥ ${minimumWidth} px${size.width<minimumWidth?'，当前未达到高清目标':''}。原图保留，可先选方向；不自动放大或重画，尺寸不代表业务审核通过。`};
}
