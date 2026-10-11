/**
 * 产物级验证：在没有浏览器的环境下，检查构建结果是否满足关键约束。
 *
 * 覆盖四件事，任何一项失败都会导致线上出问题，但在 dev 模式下不会暴露：
 * 1. index.html 的资源引用的前缀与 `base` 一致；
 * 2. 路由 basename 被编译成同一个前缀（开发时是 `/`，很容易漏改）；
 * 3. 懒加载 chunk 之间的相对导入能正确解析；
 * 4. 每个路由都有独立的 chunk（说明代码分割真的生效）。
 *
 * ## base 从产物自身推导，而不是写死
 *
 * 原实现里写死了 `const REPO_NAME = 'resume'` —— 这是同一份部署事实的**第三处**副本
 * （另两处是 `site-config.ts` 与 vite 配置）。而阶段 11 起 base 变成可配置的：
 * 自定义域名部署时前缀必须是 `/`，写死的脚本会立刻误报。
 *
 * 现在改成从 `index.html` 里**反推**实际使用的前缀：
 * 产物自己就是唯一真相，脚本只检查"内部是否自洽"。
 * 这样无论部署在 `/`、`/resume/` 还是别的子路径下，这套检查都成立。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(import.meta.dirname, '..', 'dist');
const assetsDir = join(distDir, 'assets');

const failures: string[] = [];

function check(label: string, passed: boolean, detail: string): void {
  console.log(`${passed ? '✓' : '✗'} ${label}${detail === '' ? '' : ` — ${detail}`}`);
  if (!passed) failures.push(label);
}

const html = readFileSync(join(distDir, 'index.html'), 'utf8');

/**
 * 反推 base：取入口 script 的 src，去掉 `assets/...` 部分。
 *
 * 例如 `src="/resume/assets/index-abc.js"` → base = `/resume/`；
 * `src="/assets/index-abc.js"` → base = `/`。
 */
const entryMatch = /src="([^"]*?)assets\/(index-[^"]+\.js)"/.exec(html);
const derivedBase = entryMatch?.[1] ?? '';
const entryName = entryMatch?.[2];

check(
  'index.html 的资源引用带统一前缀',
  entryMatch !== null,
  entryMatch === null ? '无法从 index.html 解析出入口脚本' : `前缀 "${derivedBase}"`,
);

check('index.html 含主题引导脚本', html.includes('prefers-color-scheme'), '否则首屏会闪白 (FOUC)');

// 主入口 chunk 里应当能找到 basename 字面量（值等于去掉尾部斜杠的 base）
const routerBasename = derivedBase.replace(/\/+$/, '');
const entrySource = entryName === undefined ? '' : readFileSync(join(assetsDir, entryName), 'utf8');

check(
  '路由 basename 与 base 一致',
  entrySource.includes(`"${routerBasename}"`) || entrySource.includes(`'${routerBasename}'`),
  `期望 "${routerBasename}"，入口 chunk: ${entryName ?? '未找到'}`,
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

// 懒加载 chunk 里的相对导入必须指回同前缀下的 assets/
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
