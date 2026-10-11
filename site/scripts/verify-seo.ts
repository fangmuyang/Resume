/**
 * SEO 产物校验。
 *
 *   pnpm verify:seo
 *
 * ## 为什么需要这个脚本
 *
 * sitemap、robots.txt、manifest 都是**生成的**文件，它们不会因为写错而报错：
 * - sitemap 里少一条 URL → 那篇文章很久不被收录，没有任何报错；
 * - robots.txt 里的 Sitemap 地址写错 → 爬虫找不到 sitemap，同样没报错；
 * - manifest 的 scope 与 base 不一致 → 应用装上后打开是白屏。
 *
 * 这些都是"静默失效"，靠人看是很难发现的，所以用脚本在构建后检查。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASE_PATH, BASE_PREFIX, SITE_ORIGIN } from '../src/lib/seo/site-config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const distDir = join(projectRoot, 'dist');
const contentDir = join(projectRoot, 'content');

/** 收集到的失败项；末尾统一打印，避免只报第一个问题 */
const failures: string[] = [];
const notes: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

function ok(message: string): void {
  notes.push(message);
}

function readDist(relativePath: string): string {
  const full = join(distDir, relativePath);
  if (!existsSync(full)) {
    fail(`缺少产物文件 dist/${relativePath}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

// ---------------- sitemap.xml ----------------

function checkSitemap(): void {
  const xml = readDist('sitemap.xml');
  if (xml === '') return;

  // 命名空间拼错是最容易犯的错：sitemap.org 少一个 s
  if (!xml.includes('http://www.sitemaps.org/schemas/sitemap/0.9')) {
    fail('sitemap.xml 的命名空间不正确（应为 http://www.sitemaps.org/...，注意 sitemaps 是复数）');
  }

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] as string);

  if (locs.length === 0) {
    fail('sitemap.xml 里没有任何 <loc> 条目');
    return;
  }

  // 所有 URL 都必须带部署前缀，且是绝对地址
  const wrongPrefix = locs.filter((loc) => !loc.startsWith(SITE_ORIGIN));
  if (wrongPrefix.length > 0) {
    fail(`sitemap.xml 里有 ${wrongPrefix.length} 条 URL 的地址前缀不正确：${wrongPrefix[0] ?? ''}`);
  }

  // 首页必须被收录
  if (!locs.some((loc) => loc === `${SITE_ORIGIN}/`)) {
    fail(`sitemap.xml 缺少首页条目 ${SITE_ORIGIN}/`);
  }

  // 内容里的文章与项目都应出现在 sitemap 中
  const postsIndex = JSON.parse(readFileSync(join(contentDir, 'posts-index.json'), 'utf8')) as {
    posts: { slug: string; draft: boolean }[];
  };

  const publishedSlugs = postsIndex.posts.filter((post) => !post.draft).map((post) => post.slug);
  const missingPosts = publishedSlugs.filter(
    (slug) => !locs.some((loc) => loc.endsWith(`/posts/${slug}`)),
  );
  if (missingPosts.length > 0) {
    fail(`sitemap.xml 缺少 ${missingPosts.length} 篇文章：${missingPosts.join('、')}`);
  }

  // 草稿不应被收录
  const draftSlugs = postsIndex.posts.filter((post) => post.draft).map((post) => post.slug);
  const leakedDrafts = draftSlugs.filter((slug) =>
    locs.some((loc) => loc.endsWith(`/posts/${slug}`)),
  );
  if (leakedDrafts.length > 0) {
    fail(`sitemap.xml 收录了草稿：${leakedDrafts.join('、')}`);
  }

  ok(`sitemap.xml 共 ${locs.length} 条 URL，包含全部 ${publishedSlugs.length} 篇已发布文章`);
}

// ---------------- robots.txt ----------------

function checkRobots(): void {
  const text = readDist('robots.txt');
  if (text === '') return;

  if (!/User-agent:\s*\*/i.test(text)) {
    fail('robots.txt 缺少 User-agent 声明');
  }

  // Sitemap 必须是绝对地址 —— 相对路径在 robots.txt 里是无效的
  const sitemapLine = /^Sitemap:\s*(.+)$/im.exec(text);
  if (sitemapLine === null) {
    fail('robots.txt 缺少 Sitemap 声明');
  } else {
    const declared = (sitemapLine[1] as string).trim();
    const expected = `${SITE_ORIGIN}/sitemap.xml`;

    if (!declared.startsWith('http')) {
      fail(`robots.txt 的 Sitemap 必须是绝对地址，当前是 ${declared}`);
    } else if (declared !== expected) {
      fail(`robots.txt 的 Sitemap 地址与部署地址不一致：${declared} ≠ ${expected}`);
    }
  }

  ok('robots.txt 声明了抓取规则与 sitemap 地址');
}

// ---------------- index.html ----------------

function checkIndexHtml(): void {
  const html = readDist('index.html');
  if (html === '') return;

  /**
   * 检查标签时用**属性**而不是整段字符串匹配。
   * 直接 `html.includes('rel="apple-touch-icon"')` 会漏掉属性顺序被格式化插件
   * 调整过的情况（虽然 Vite 不改 HTML，但保持判断方式健壮没有代价）。
   */
  const hasLinkRel = (rel: string): boolean =>
    new RegExp(`<link[^>]+rel=["']${rel}["']`, 'i').test(html);

  if (!hasLinkRel('icon')) fail('index.html 缺少 favicon 的 <link rel="icon">');
  if (!hasLinkRel('apple-touch-icon')) {
    fail('index.html 缺少 <link rel="apple-touch-icon">（iOS 不读 manifest 的 icons）');
  }
  if (!hasLinkRel('manifest')) fail('index.html 缺少 manifest 链接（PWA 插件未生效？）');

  const descriptionMatch = /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(
    html,
  );
  if (descriptionMatch === null) {
    fail('index.html 缺少默认的 meta description');
  }

  if (!/<title>[^<]+<\/title>/i.test(html)) {
    fail('index.html 缺少 <title>');
  }

  /**
   * index.html 里的描述是**模板里写死的**（React 渲染之前就要有内容，
   * 供不执行 JavaScript 的爬虫读取）。这就产生了与内容文件重复的风险：
   * 改了 content/profile-public.json 的 seo 字段，却忘了同步模板。
   *
   * 这类不一致不会报错，只会让分享卡片与搜索结果里的描述长期是旧的，
   * 所以在这里显式核对。
   */
  const profile = JSON.parse(readFileSync(join(contentDir, 'profile-public.json'), 'utf8')) as {
    seo?: { defaultDescription?: string };
  };
  const expectedDescription = profile.seo?.defaultDescription;

  if (descriptionMatch !== null && expectedDescription !== undefined) {
    const actual = descriptionMatch[1] ?? '';
    if (actual !== expectedDescription) {
      fail(
        `index.html 的 meta description 与内容不一致：\n` +
          `      index.html            → ${actual}\n` +
          `      profile-public.json   → ${expectedDescription}`,
      );
    }
  }

  // 主题引导脚本必须存在且是阻塞式的（不能带 defer / async）
  const themeScript = /<script>(?:(?!<\/script>)[\s\S])*resume-site-theme[\s\S]*?<\/script>/.exec(
    html,
  );
  if (themeScript === null) {
    fail('index.html 缺少阻塞式主题引导脚本（首屏会闪白）');
  }

  ok('index.html 的图标链接、manifest、描述、标题与主题脚本齐备，且描述与内容一致');
}

// ---------------- manifest ----------------

interface ManifestShape {
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  lang?: string;
  icons?: { src: string; sizes: string; purpose?: string }[];
}

function checkManifest(): void {
  const raw = readDist('manifest.webmanifest');
  if (raw === '') return;

  let manifest: ManifestShape;
  try {
    manifest = JSON.parse(raw) as ManifestShape;
  } catch (error) {
    fail(`manifest.webmanifest 不是合法 JSON：${(error as Error).message}`);
    return;
  }

  const expectedScope = BASE_PREFIX;

  if (manifest.scope !== expectedScope) {
    fail(`manifest 的 scope 与部署路径不一致：${String(manifest.scope)} ≠ ${expectedScope}`);
  }
  if (manifest.start_url !== expectedScope) {
    fail(
      `manifest 的 start_url 与部署路径不一致：${String(manifest.start_url)} ≠ ${expectedScope}`,
    );
  }
  if (manifest.display !== 'standalone') {
    fail(`manifest 的 display 应为 standalone，当前是 ${String(manifest.display)}`);
  }

  const icons = manifest.icons ?? [];

  // 安装性要求：至少一个 192 与一个 512
  if (!icons.some((icon) => icon.sizes === '192x192')) {
    fail('manifest 缺少 192x192 图标（浏览器安装性要求）');
  }
  if (!icons.some((icon) => icon.sizes === '512x512')) {
    fail('manifest 缺少 512x512 图标（浏览器安装性要求）');
  }
  // maskable 需要单独一张，否则 Android 裁切会切掉内容
  if (!icons.some((icon) => icon.purpose === 'maskable')) {
    fail('manifest 缺少 purpose 为 maskable 的图标（Android 自适应图标需要）');
  }

  // 图标文件必须真的存在
  for (const icon of icons) {
    if (!existsSync(join(distDir, icon.src))) {
      fail(`manifest 引用的图标不存在：dist/${icon.src}`);
    }
  }

  ok(`manifest 有效，包含 ${icons.length} 个图标且 scope 与 base 一致`);
}

// ---------------- service worker ----------------

function checkServiceWorker(): void {
  if (!existsSync(join(distDir, 'sw.js'))) {
    fail('缺少 dist/sw.js（PWA 插件未生成 service worker）');
    return;
  }

  const register = readDist('registerSW.js');
  if (register === '') return;

  // 注册脚本里的路径必须带 base 前缀，否则子路径部署下注册会 404
  if (!register.includes(BASE_PATH === '' ? '/' : BASE_PATH)) {
    fail(`registerSW.js 里的路径不含部署前缀 ${BASE_PREFIX}（service worker 会注册失败）`);
  }

  ok('service worker 已生成，注册脚本路径带部署前缀');
}

/**
 * 检查"每路由一个 HTML 入口"是否齐备。
 *
 * ## 为什么需要这个检查
 *
 * 这些入口由 `build-prerender.ts` 生成，是 SPA 部署到静态托管的**必要条件**：
 * 少了 `about/index.html`，用户刷新 `/resume/about` 就会拿到 404。
 *
 * 而这属于"静默失效"：漏生成不会报错，构建照样成功，
 * 只有真实访客刷新深层页面时才会遇到。所以按内容数据核对一遍。
 */
function checkRouteShells(): void {
  const postsIndex = JSON.parse(readFileSync(join(contentDir, 'posts-index.json'), 'utf8')) as {
    posts: { slug: string; draft: boolean }[];
  };

  const projectSlugs = readdirSync(join(contentDir, 'projects'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));

  const expected = [
    'about',
    'projects',
    'posts',
    'resume',
    'contact',
    ...projectSlugs.map((slug) => `projects/${slug}`),
    ...postsIndex.posts.filter((post) => !post.draft).map((post) => `posts/${post.slug}`),
  ];

  const missing = expected.filter((dir) => !existsSync(join(distDir, dir, 'index.html')));

  if (missing.length > 0) {
    fail(
      `缺少 ${String(missing.length)} 个路由入口（刷新这些地址会 404）：\n` +
        missing.map((dir) => `      ${BASE_PREFIX}${dir}`).join('\n'),
    );
    return;
  }

  // 草稿不该有入口：否则能被直接访问到
  const draftShells = postsIndex.posts
    .filter((post) => post.draft)
    .filter((post) => existsSync(join(distDir, 'posts', post.slug, 'index.html')));

  if (draftShells.length > 0) {
    fail(`草稿生成了路由入口：${draftShells.map((post) => post.slug).join('、')}`);
    return;
  }

  ok(`每路由 HTML 入口齐备（${String(expected.length)} 个），草稿已排除`);
}

/** 检查 404 兜底页 */
function check404Fallback(): void {
  const fallback = join(distDir, '404.html');

  if (!existsSync(fallback)) {
    fail('缺少 dist/404.html（未枚举的路径会显示托管商的默认 404 页）');
    return;
  }

  // 它应当是 SPA 外壳，而不是一张静态的"找不到页面"图片
  if (!readFileSync(fallback, 'utf8').includes('id="root"')) {
    fail('dist/404.html 不含应用挂载点，不是 SPA 外壳（前端路由无法接管）');
    return;
  }

  ok('404.html 为 SPA 外壳，未枚举的路径也会显示应用内的 404 界面');
}

function main(): void {
  if (!existsSync(distDir)) {
    console.error('找不到 dist/ 目录。请先运行 `pnpm build`。');
    process.exit(1);
  }

  checkSitemap();
  checkRobots();
  checkIndexHtml();
  checkManifest();
  checkServiceWorker();
  checkRouteShells();
  check404Fallback();

  console.log(`SEO 与 PWA 产物检查（${relative(repoRoot, distDir)}）\n`);

  /**
   * 只在全部通过时打印各条 ✓。
   *
   * 否则会出现自相矛盾的输出：同一个检查项既有一条 ✓，
   * 又出现在失败列表里（因为一个 check 函数可能既记录成功项、又发现某个子项失败）。
   * 失败时读者只需要看问题清单。
   */
  if (failures.length === 0) {
    for (const note of notes) {
      console.log(`  ✓ ${note}`);
    }
    console.log('\nSEO 与 PWA 产物检查全部通过。');
    return;
  }

  console.error(`✗ 发现 ${failures.length} 个问题：\n`);
  for (const failure of failures) {
    console.error(`  · ${failure}`);
  }
  process.exit(1);
}

main();
