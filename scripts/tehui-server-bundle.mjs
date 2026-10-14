#!/usr/bin/env node
// fork：把一次发布的产物整理成可以直接上传到服务器的目录（见 FORK.md「发布」）。
//
//   <out>/latest.json          自动更新清单，下载地址指向 <base-url>/<tag>/<文件名>
//   <out>/<tag>/...            安装包、更新包和 .sig
//   <out>/index.html           下载页（应用里「检查更新」兜底时打开的就是它）
//
// 上传时把 <out> 里的内容整个放进服务器的 download/cc-switch/ 目录，覆盖 latest.json 和 index.html。
//
// Usage: node scripts/tehui-server-bundle.mjs <assets-dir> <tag> <base-url> <out-dir>

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [assetsDir, tag, baseUrl, outDir] = process.argv.slice(2);
if (!assetsDir || !tag || !baseUrl || !outDir) {
  console.error('Usage: node scripts/tehui-server-bundle.mjs <assets-dir> <tag> <base-url> <out-dir>');
  process.exit(1);
}

const base = baseUrl.replace(/\/+$/, '');
const versionDir = join(outDir, tag);
mkdirSync(versionDir, { recursive: true });

const names = readdirSync(assetsDir).filter((name) => name !== 'latest.json').sort();
for (const name of names) {
  copyFileSync(join(assetsDir, name), join(versionDir, name));
}

// 更新清单：沿用上游的改写脚本，签名只覆盖文件内容，改下载地址不影响校验
execFileSync(
  process.execPath,
  ['scripts/rewrite-updater-manifest.mjs', join(assetsDir, 'latest.json'), tag, base, join(outDir, 'latest.json')],
  { stdio: 'inherit' },
);

// 下载页：只列用户会手动下载的安装包
const DOWNLOADS = [
  { suffix: '-Windows.msi', label: 'Windows 安装版', note: '大多数 Windows 电脑选这个' },
  { suffix: '-Windows-arm64.msi', label: 'Windows 安装版（ARM64）', note: '骁龙等 ARM 芯片的 Windows 电脑' },
  { suffix: '-macOS.dmg', label: 'macOS 安装包', note: 'Apple 芯片和 Intel 芯片通用' },
  { suffix: '-Windows-Portable.zip', label: 'Windows 绿色版', note: '解压即用，不会自动更新' },
  { suffix: '-Windows-arm64-Portable.zip', label: 'Windows 绿色版（ARM64）', note: '解压即用，不会自动更新' },
  { suffix: '-macOS.zip', label: 'macOS 压缩包', note: '解压后拖进「应用程序」' },
];

const escapeHtml = (value) =>
  value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const sizeOf = (name) => `${(statSync(join(versionDir, name)).size / 1024 / 1024).toFixed(1)} MB`;

const rows = DOWNLOADS.flatMap(({ suffix, label, note }) => {
  const name = names.find((file) => file.endsWith(suffix));
  if (!name) return [];
  const href = `${tag}/${encodeURIComponent(name)}`;
  return [
    `<li><a href="${href}"><b>${escapeHtml(label)}</b><span>${escapeHtml(note)} · ${sizeOf(name)}</span></a></li>`,
  ];
});
if (rows.length === 0) {
  console.error(`No installers found in ${assetsDir}`);
  process.exit(1);
}

const version = tag.replace(/^v/, '');
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CC Switch ${escapeHtml(version)} 下载</title>
<style>
  body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #0a0a0a; max-width: 640px; margin: 48px auto; padding: 0 20px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  p.sub { color: #71717a; margin: 0 0 24px; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
  a { display: flex; flex-direction: column; padding: 14px 16px; border: 1px solid #e4e4e7; border-radius: 12px; color: inherit; text-decoration: none; }
  a:hover { border-color: #4f46e5; }
  a span { color: #71717a; font-size: 13px; }
  .note { margin-top: 24px; padding: 12px 16px; border-radius: 12px; background: #fffbeb; border: 1px solid #fde68a; font-size: 14px; }
  footer { margin-top: 32px; color: #a1a1aa; font-size: 12.5px; }
  footer a { display: inline; padding: 0; border: 0; color: inherit; text-decoration: underline; }
</style>
</head>
<body>
<h1>CC Switch ${escapeHtml(version)}</h1>
<p class="sub">特惠 API 提供的安装包，已去掉第三方推广。装好后在控制台「API 密钥」点 CC Switch 图标即可一键导入。</p>
<ul>
${rows.join('\n')}
</ul>
<div class="note"><b>macOS 第一次打开提示无法验证开发者？</b><br>打开「系统设置 › 隐私与安全性」，拉到底部点击「仍然打开」，之后就能正常使用。</div>
<footer>基于开源项目 <a href="https://github.com/farion1231/cc-switch">CC Switch</a>（MIT 许可）构建。</footer>
</body>
</html>
`,
);

console.log(`Server bundle for ${tag} written to ${outDir} (${names.length} files)`);
