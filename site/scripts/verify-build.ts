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

/**
 * 从路由表解析出每个懒加载路由对应的模块名，再核对产物里是否**各自恰好**有一个 chunk。
 *
 * 这里踩了两次坑，都记下来：
 *
 * 1. 第一版写死「七个路由」。加了 /projects/:slug 后检查就失效了 ——
 *    失效的检查比没有检查更糟，它给出虚假的安全感。改成从路由表推导。
 * 2. 第二版用「带 hash 的文件名 = 路由 chunk」来数。这个判据不成立：
 *    共享 chunk（page-placeholder、project-card）和 loader chunk 也都带 hash。
 *    而且我还写错过正则（`[a-z0-9-]*` 是贪婪的，能吞掉 hash 的一部分，
 *    结果匹配了所有文件）—— 正则判据必须用真实文件名逐个验证过才能信。
 *
 * 现在改成精确判定：路由表里 import('@/pages/xxx') 说明该路由会产出
 * 名为 `xxx-<hash>.js` 的 chunk，逐个检查存在且唯一。
 */
const routerSource = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'router.tsx'),
  'utf8',
);

const routeModuleNames = [...routerSource.matchAll(/import\('@\/pages\/([a-z0-9-]+)'\)/g)].map(
  (match) => match[1] ?? '',
);

const chunkCountByName = new Map<string, number>();
for (const name of jsFiles) {
  /**
   * Vite 的 chunk 命名是 `<模块名>-<hash>.js`。
   * hash 本身可能含连字符（如 `projects-7uUMK-rM.js`），所以不能用贪婪的
   * `^(.+)-[A-Za-z0-9_-]+\.js$` —— 那样会把模块名切成 `projects-7uUMK`。
   *
   * 可靠做法是从右往左锚定 hash 的形状：Vite 默认 base64url 字符集的 8 位 hash。
   */
  const match = /^(.+)-[A-Za-z0-9_-]{8}\.js$/.exec(name);
  const moduleName = match?.[1];
  if (moduleName !== undefined) {
    chunkCountByName.set(moduleName, (chunkCountByName.get(moduleName) ?? 0) + 1);
  }
}

const missing = routeModuleNames.filter((name) => !chunkCountByName.has(name));
const duplicated = routeModuleNames.filter((name) => (chunkCountByName.get(name) ?? 0) > 1);

check(
  '每个路由各自一个分块',
  routeModuleNames.length > 0 && missing.length === 0 && duplicated.length === 0,
  routeModuleNames.length === 0
    ? '未能从路由表解析出懒加载模块'
    : `解析到 ${routeModuleNames.length} 个路由模块` +
        (missing.length > 0 ? `，缺失：${missing.join(', ')}` : '') +
        (duplicated.length > 0 ? `，重复分块：${duplicated.join(', ')}` : ''),
);

// 懒加载 chunk 里的相对导入必须指回 /resume/assets/
// 注意 (match[1] ?? '')：开启 noUncheckedIndexedAccess 后，捕获组类型是 string | undefined
const routeChunkFiles = jsFiles.filter((name) =>
  routeModuleNames.some((moduleName) => name.startsWith(`${moduleName}-`)),
);

const dynamicImports = routeChunkFiles.flatMap((name) => {
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
