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
  const target = page.trim()
    ? { kind: 'explicit-page', value: page.trim(), source: 'user' }
    : { kind: 'host-startup-page', value: '宿主默认首页', source: 'default', resolution: '读取宿主启动入口及路由，确认真实首页；无法唯一判断时才询问。' };
  const library = {
    name: 'DangoUI Variant 库',
    url: 'https://jocelyntong.github.io/DangoUI-Brand-Skill/#/variants',
    selection: '先选品牌，再切换场景；点击「复制使用描述」，将内容发回当前会话。也可直接发送场景链接和目标页面。',
    boundary: '场景预览是视觉参考，不等于宿主已适配；Variant 库不是机器读取的品牌 Registry。',
  };
  const example = '$brand 参考【Variant 场景链接或品牌官网】，先为当前项目生成三个完整效果图。';
  const scopeNotice = `品牌参考已收到。我先以${target.value}生成三个不同方向的完整效果图，保留页面业务内容；成功一张先展示一张。这一步不修改项目代码。`;
  const welcome = missing.length ? [
    `可以先浏览 [${library.name}](${library.url})。${library.selection}`,
    '也可以自带官网、截图或设计文件作为参考。',
    `Codex 示例：${example}\nClaude Code 可将 $brand 换成 /brand；也可以说“请使用 brand skill”。`,
    ...missing.map(item => item.question),
  ].join('\n\n') : scopeNotice;
  return {
    library, usage: {codex: '$brand', claudeCode: '/brand', naturalLanguage: '请使用 brand skill'}, welcome,
    schema: 'brand-initialization/v1', installStatus, readOnly: true,
    project, issue, inputs: {reference, page}, target, missing,
    status: missing.length ? 'needs-input' : 'ready-for-planning',
    requestLifecycle: {kind:'new-concept-round', reusePriorOutcome:false, preservePriorArtifacts:true, artifactRoot:'allocate-new', brandInput:'resolve-current', wholeHostAuthorized:false},
    next: missing.length ? '只询问缺失信息；不得启动换肤。' : '说明范围后读取 target 对应宿主事实，进入 host-concepts / full-image 正常入口生成三张完整效果图；成功一张先展示一张，不修改宿主。当前明确的只读检查或暂停指令仍优先，不因 init 就擅自生图。',
    example,
    boundary: '安装成功不等于自动开始执行；本入口不联网、不写文件、不运行宿主命令、不沿用旧方向。',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = flag => { const i = args.indexOf(flag); if (i < 0) return undefined; if (!args[i+1] || args[i+1].startsWith('--')) throw new Error(`Missing value: ${flag}`); return args[i+1]; };
  try { console.log(JSON.stringify(initializeBrand({host:value('--host'),hostConfirmed:args.includes('--host-confirmed'),reference:value('--reference'),page:value('--page'),installStatus:value('--install-status')}),null,2)); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
