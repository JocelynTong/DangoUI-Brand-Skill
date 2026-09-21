#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function initializeBrand({ host, hostConfirmed = false, reference = '', page = '', installStatus = 'unknown' } = {}) {
  const directory = path.resolve(host || process.cwd());
  let project = null;
  let issue = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    const dependencies = {...pkg.dependencies, ...pkg.devDependencies};
    project = { directory, name: pkg.name || null, frameworks: ['@tarojs/taro','vue','react','vite'].filter(key => key in dependencies) };
  } catch { issue = '无法从此目录的 package.json 确认前端项目；请确认目标目录。'; }
  const missing = [];
  if (!project || !hostConfirmed) missing.push({ field: 'host', question: `要使用的项目目录是 ${directory} 吗？若不是，请提供目标目录。` });
  if (!reference.trim()) missing.push({ field: 'reference', question: '想参考哪个品牌？可以提供官网、截图或设计文件。' });
  if (!page.trim()) missing.push({ field: 'page', question: '这次想改哪个页面，或让用户完成什么任务？' });
  return {
    schema: 'brand-initialization/v1', installStatus, readOnly: true,
    project, issue, inputs: {reference, page}, missing,
    status: missing.length ? 'needs-input' : 'ready-for-planning',
    next: missing.length ? '只询问缺失信息；不得启动换肤。' : '总结宿主、参考与目标，进入正常品牌学习/方案流程；不直接实施。',
    example: '参考【品牌官网】，为当前项目的【页面】设计换肤方案，保留已有内容和交互，先给我方案选择。',
    boundary: '安装成功不等于自动开始执行；本入口不联网、不写文件、不运行宿主命令、不沿用旧方向。',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); if (i < 0) return undefined; if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`Missing value: ${flag}`); return args[i+1]; };
  try { console.log(JSON.stringify(initializeBrand({host:value('--host'),hostConfirmed:args.includes('--host-confirmed'),reference:value('--reference'),page:value('--page'),installStatus:value('--install-status')}),null,2)); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
