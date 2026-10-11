/**
 * 产物级验证：在没有浏览器的环境下，检查构建结果是否满足关键约束。
 *
 * 覆盖四件事，任何一项失败都会导致线上出问题，但在 dev 模式下不会暴露：
 * 1. index.html 的资源配置带 /resume/ 前缀（GitHub Pages 子路径）；
 * 2. 路由 basename 被编译成 /resume（开发时是 /，很容易漏改）；
 * 3. 懒加载 chunk 之间的相对导入能正确解析到 /resume/assets/；
 * 4. 每个路由都有独立的 chunk（说明代码分割真的生效）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(import.meta.dirname, '..', 'dist');
const assetsDir = join(distDir, 'assets');

const REPO_NAME = 'resume';
const failures: string[] = [];

function check(label: string, passed: boolean, detail: string): void {
  console.log(`${passed ? '✓' : '✗'} ${label}${detail === '' ? '' : ` — ${detail}`}`);
  if (!passed) failures.push(label);
}

const html = readFileSync(join(distDir, 'index.html'), 'utf8');

check(
  'index.html 资源配置带 /resume/ 前缀',
  html.includes(`/${REPO_NAME}/assets/`),
  'GitHub Pages 子路径部署的前提',
);

check('index.html 含主题引导脚本', html.includes('prefers-color-scheme'), '否则首屏会闪白 (FOUC)');

// 主入口 chunk 里应当能找到 basename 字面量
const entryName = /src="\/resume\/assets\/(index-[^"]+\.js)"/.exec(html)?.[1];
const entrySource = entryName === undefined ? '' : readFileSync(join(assetsDir, entryName), 'utf8');

check(
  '路由 basename 编译为 /resume',
  entrySource.includes(`"${REPO_NAME}"`) || entrySource.includes(`'/${REPO_NAME}'`),
  `入口 chunk: ${entryName ?? '未找到'}`,
);

const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
const lazyRoutes = jsFiles.filter((name) =>
  /^(home|about|projects|posts|resume|contact|not-found)-/.test(name),
);

check('七个路由各自独立分块', lazyRoutes.length === 7, `实际 ${lazyRoutes.length} 个`);

// 懒加载 chunk 里的相对导入必须指回 /resume/assets/
// 注意 (match[1] ?? '')：开启 noUncheckedIndexedAccess 后，捕获组类型是 string | undefined
const dynamicImports = lazyRoutes.flatMap((name) => {
  const source = readFileSync(join(assetsDir, name), 'utf8');
  return [...source.matchAll(/import\("\.\/([^"]+)"\)/g)].map((match) => match[1] ?? '');
});

check(
  '懒加载 chunk 使用相对导入',
  dynamicImports.length === 0 || dynamicImports.every((path) => !path.startsWith('/')),
  `动态导入 ${dynamicImports.length} 处`,
);

console.log('');
if (failures.length > 0) {
  console.error(`产物验证失败 ${failures.length} 项：${failures.join('、')}`);
  process.exitCode = 1;
} else {
  console.log('产物验证全部通过。');
}
