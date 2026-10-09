import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

let sharpModule;
const size = (width, height) => Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null;
const unknown = (reason) => ({ intrinsicSize: null, alphaChannel: 'unknown', transparency: 'unknown', maxSafeDisplaySize: null, inspection: { status: 'unknown', method: 'none', reason } });
const result = (dimensions, alphaChannel, method, transparency = 'unknown') => ({ intrinsicSize: dimensions, alphaChannel, transparency, maxSafeDisplaySize: dimensions ? { ...dimensions } : null, inspection: { status: dimensions ? 'inspected' : 'unknown', method } });

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function svgSpecs(bytes) {
  const text = bytes.toString('utf8');
  const root = text.match(/<svg\b([^>]*)>/i);
  if (!root || !/<\/svg\s*>|<svg\b[^>]*\/\s*>/i.test(text)) return unknown('invalid-svg');
  const attr = (name) => root[1].match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
  const length = (value) => /^\s*(?:\d+(?:\.\d*)?|\.\d+)(?:px)?\s*$/.test(value || '') ? Number(String(value).trim().replace(/px$/, '')) : null;
  const width = length(attr('width')), height = length(attr('height'));
  const viewBox = String(attr('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const box = viewBox.length === 4 && viewBox.every(Number.isFinite) ? size(viewBox[2], viewBox[3]) : null;
  // A viewBox gives a coordinate extent, not an intrinsic pixel size.
  let dimensions = size(width, height);
  if (!dimensions && box && width > 0) dimensions = size(width, width * box.height / box.width);
  if (!dimensions && box && height > 0) dimensions = size(height * box.width / box.height, height);
  return { ...result(dimensions, 'unknown', 'svg-attributes'), svg: { width: attr('width') ?? null, height: attr('height') ?? null, viewBox: box ? viewBox : null }, ...(!dimensions ? { inspection: { status: 'unknown', method: 'svg-attributes', reason: 'intrinsic-pixel-size-unresolved' } } : {}) };
}

function rasterHeaders(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let cursor = 8, header, alpha = false, ended = false;
    const imageData = [];
    while (cursor + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(cursor), type = bytes.toString('ascii', cursor + 4, cursor + 8);
      if (cursor + 12 + length > bytes.length) return unknown('truncated-png');
      const data = bytes.subarray(cursor + 8, cursor + 8 + length);
      if (crc32(bytes.subarray(cursor + 4, cursor + 8 + length)) !== bytes.readUInt32BE(cursor + 8 + length)) return unknown('invalid-png-checksum');
      if (type === 'IHDR') { if (length !== 13 || header) return unknown('invalid-png-header'); header = data; }
      if (type === 'tRNS') alpha = true;
      if (type === 'IDAT') imageData.push(data);
      if (type === 'IEND') { ended = true; break; }
      cursor += length + 12;
    }
    if (!header || !ended || !imageData.length || ![0, 2, 3, 4, 6].includes(header[9])) return unknown('invalid-png');
    const decoded = inflateSync(Buffer.concat(imageData), { maxOutputLength: 64 * 1024 * 1024 });
    const dimensions = size(header.readUInt32BE(0), header.readUInt32BE(4));
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header[9]];
    const bitDepth = header[8];
    const permittedDepth = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[header[9]];
    if (!dimensions || !permittedDepth.includes(bitDepth) || header[10] !== 0 || header[11] !== 0 || ![0, 1].includes(header[12]) || !decoded.length) return unknown('invalid-png-data');
    if (header[12] === 0) {
      const stride = 1 + Math.ceil(dimensions.width * channels * bitDepth / 8);
      if (decoded.length !== stride * dimensions.height) return unknown('invalid-png-scanlines');
      for (let offset = 0; offset < decoded.length; offset += stride) if (decoded[offset] > 4) return unknown('invalid-png-filter');
    }
    alpha ||= [4, 6].includes(header[9]);
    return result(dimensions, alpha ? 'present' : 'absent', 'png-structure', alpha ? 'unknown' : 'absent');
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return unknown('truncated-jpeg');
    let cursor = 2;
    while (cursor + 4 <= bytes.length) {
      if (bytes[cursor++] !== 0xff) return unknown('invalid-jpeg-marker');
      while (bytes[cursor] === 0xff) cursor++;
      const marker = bytes[cursor++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes.readUInt16BE(cursor);
      if (length < 2 || cursor + length > bytes.length) return unknown('truncated-jpeg-segment');
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) return result(size(bytes.readUInt16BE(cursor + 5), bytes.readUInt16BE(cursor + 3)), 'absent', 'jpeg-header', 'absent');
      cursor += length;
    }
    return unknown('jpeg-size-unresolved');
  }
  if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6)) && bytes.length >= 14 && bytes[bytes.length - 1] === 0x3b) {
    // Without decoding extension/image blocks, per-frame transparency remains unknown.
    return result(size(bytes.readUInt16LE(6), bytes.readUInt16LE(8)), 'unknown', 'gif-header');
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length) return unknown('invalid-webp-size');
    for (let cursor = 12; cursor + 8 <= bytes.length;) {
      const type = bytes.toString('ascii', cursor, cursor + 4), length = bytes.readUInt32LE(cursor + 4), start = cursor + 8;
      if (start + length > bytes.length) return unknown('truncated-webp');
      if (type === 'VP8X' && length === 10) return result(size(1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)), bytes[start] & 16 ? 'present' : 'absent', 'webp-header', bytes[start] & 16 ? 'unknown' : 'absent');
      if (type === 'VP8L' && length >= 5 && bytes[start] === 0x2f) {
        const packed = bytes.readUInt32LE(start + 1), alpha = Boolean(packed & 0x10000000);
        return result(size(1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff)), alpha ? 'present' : 'absent', 'webp-header', alpha ? 'unknown' : 'absent');
      }
      if (type === 'VP8 ' && length >= 10 && bytes.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 1, 0x2a]))) return result(size(bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff), 'absent', 'webp-header', 'absent');
      cursor = start + length + (length % 2);
    }
  }
  return unknown('unsupported-or-invalid-format');
}

/** Mechanical file facts only. Page identity and uses must come from visible DOM bindings. */
export async function inspectRenderedAsset(file, mime = '') {
  try {
    const bytes = await readFile(file);
    if (/^image\/svg\+xml(?:;|$)/i.test(mime) || /^(?:\s*<\?xml[^>]*>\s*)?(?:\s*<!--[^]*?-->\s*)*<svg\b/i.test(bytes.toString('utf8', 0, Math.min(bytes.length, 2048)))) return svgSpecs(bytes);
    sharpModule ??= import('sharp').then((module) => module.default).catch(() => null);
    const sharp = await sharpModule;
    if (sharp) {
      const metadata = await sharp(bytes).metadata();
      const dimensions = size(metadata.width, metadata.height);
      if (dimensions) return result(dimensions, metadata.hasAlpha ? 'present' : 'absent', 'sharp-metadata', metadata.hasAlpha ? 'unknown' : 'absent');
    }
    return rasterHeaders(bytes);
  } catch (error) {
    return unknown(error.code === 'ENOENT' ? 'file-unavailable' : 'inspection-failed');
  }
}
