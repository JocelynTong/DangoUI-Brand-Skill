import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const releaseRoot = path.join(process.cwd(), 'output', 'brand-skill-release')
const skillRoot = path.join(releaseRoot, 'brand')
const required = ['SKILL.md', 'agents/openai.yaml', 'workflow-contract.json']
const errors = []

for (const item of required) {
  try { await stat(path.join(skillRoot, item)) } catch { errors.push(`missing:${item}`) }
}

async function files(dir) {
  const result = []
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name)
    if ((await stat(full)).isDirectory()) result.push(...await files(full))
    else result.push(full)
  }
  return result
}

const unsafe = [
  { name: 'mac-user-path', re: /\/Users\/[A-Za-z0-9._-]+\// },
  { name: 'windows-user-path', re: /[A-Za-z]:\\Users\\/ },
  { name: 'private-ip-url', re: /https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/ },
  { name: 'local-file-dependency', re: /(?:file:|link:)\/\/?.*(?:dangoui|skills?)/i },
]
for (const file of await files(skillRoot)) {
  if (/\.(png|jpe?g|gif|webp|ico)$/i.test(file)) continue
  const text = await readFile(file, 'utf8')
  for (const rule of unsafe) {
    if (rule.name === 'local-file-dependency' && file.endsWith('.md')) continue
    if (rule.re.test(text)) errors.push(`${rule.name}:${path.relative(releaseRoot, file)}`)
  }
}

if (errors.length) {
  console.error(`PUBLIC_SKILL_RELEASE_FAIL\n${errors.join('\n')}`)
  process.exit(1)
}
console.log('PUBLIC_SKILL_RELEASE_PASS')
