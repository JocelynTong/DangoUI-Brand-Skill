#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const minWidthArg = process.argv.find((arg) => arg.startsWith('--min-width='))
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
const minWidth = Number(minWidthArg?.split('=')[1] || 1440)

function dimensions(file) {
  const data = fs.readFileSync(file)
  if (data.length >= 24 && data.toString('ascii', 1, 4) === 'PNG') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue }
      const marker = data[offset + 1]
      const size = data.readUInt16BE(offset + 2)
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) }
      }
      offset += Math.max(size + 2, 2)
    }
  }
  throw new Error(`Unsupported or unreadable raster: ${file}`)
}

if (!files.length) {
  console.error('Usage: validate-mobile-raster-resolution.mjs [--min-width=1440] <image...>')
  process.exit(2)
}

let failed = false
if (sourceArg) {
  const sourceFile = sourceArg.slice('--source='.length)
  const sourceSize = dimensions(sourceFile)
  const sourcePass = sourceSize.width >= minWidth
  console.log(`${sourcePass ? 'PASS' : 'FAIL'} SOURCE ${path.basename(sourceFile)} ${sourceSize.width}x${sourceSize.height} minWidth=${minWidth}`)
  failed ||= !sourcePass
}
for (const file of files) {
  const size = dimensions(file)
  const pass = size.width >= minWidth
  console.log(`${pass ? 'PASS' : 'FAIL'} ${path.basename(file)} ${size.width}x${size.height} minWidth=${minWidth}`)
  failed ||= !pass
}
if (failed) process.exit(1)
