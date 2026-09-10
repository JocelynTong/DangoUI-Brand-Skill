import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'skills', 'brand')
const releaseRoot = path.join(root, 'output', 'brand-skill-release')
const target = path.join(releaseRoot, 'brand')

await rm(releaseRoot, { recursive: true, force: true })
await mkdir(releaseRoot, { recursive: true })
await cp(source, target, {
  recursive: true,
  filter: (entry) => {
    const name = path.basename(entry)
    return !['.DS_Store', 'node_modules'].includes(name) && !name.endsWith('.test.mjs')
  },
})

async function files(dir) {
  const result = []
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name)
    if ((await stat(full)).isDirectory()) result.push(...await files(full))
    else result.push(full)
  }
  return result
}

const manifest = []
for (const file of (await files(target)).sort()) {
  const data = await readFile(file)
  manifest.push({
    path: path.relative(releaseRoot, file),
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  })
}
await writeFile(path.join(releaseRoot, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, files: manifest }, null, 2)}\n`)
console.log(`PACKAGED ${manifest.length} files -> ${releaseRoot}`)
