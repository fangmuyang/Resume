/**
 * 生成 sitemap.xml 与 robots.txt。
 *
 *   pnpm build:seo
 *
 * ## 为什么需要静态文件
 *
 * 页面级的 `<link rel="canonical">` 告诉搜索引擎"这个页面的正式地址是哪个"，
 * 但它**不会告诉搜索引擎有哪些页面存在**。
 * 对客户端渲染的 SPA 尤其如此：爬虫从首页出发，只能靠跟踪链接逐步发现页面。
 *
 * sitemap 是主动提交的清单，robots.txt 声明抓取规则与 sitemap 位置。
 * 两者都是纯静态文件，由脚本生成后放进 `public/`，Vite 会原样拷贝。
 *
 * ## 为什么用脚本生成而不是手写
 *
 * 手写的话，新增一篇文章就要记得同时改 sitemap。
 * 忘了不会报错，只会让那篇文章很久不被收录。
 * 从内容数据生成就不会漏：文章来自 posts-index.json，项目来自 content/projects/。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASE_PREFIX, SITE_ORIGIN, toAbsoluteUrl } from '../src/lib/seo/site-config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);

/**
 * 直接写进 `dist/`，而不是 `public/`。
 *
 * ## 为什么必须放在构建**之后**
 *
 * sitemap 与 robots.txt 里包含**绝对地址**，而站点地址来自
 * `VITE_SITE_URL`（见 site-config.ts）。
 *
 * 如果先把它们生成到 `public/` 再由 Vite 拷贝，就会有一个隐患：
 * 自定义域名部署时（`VITE_SITE_URL=https://fangmu.online`），
 * 若 `public/` 里留有上一次用默认域名生成的旧文件，
 * 它会被原样拷进产物 —— sitemap 指向 `fangmuyang.github.io/resume`，
 * 而 canonical 指向 `fangmu.online`。这类不一致不会报错，
 * 只会让搜索引擎收到自相矛盾的信号。
 *
 * 改成构建后直接写 `dist/`，就彻底没有"陈旧副本"的空间：
 * 每次构建都用当前环境变量重新生成。
 */
const contentDir = join(projectRoot, 'content');
const distDir = join(projectRoot, 'dist');

interface PostIndexShape {
  posts: { slug: string; date: string; updated: string | null; draft: boolean }[];
}

interface SitemapEntry {
  path: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
}

/**
 * 拼成绝对 URL。
 *
 * 直接复用 `toAbsoluteUrl`，而不是在这里再写一遍拼接逻辑。
 *
 * 之前这里有一份独立实现，多拼了一次 `BASE_PREFIX`，
 * 生成出 `…/resume/resume/` 这样的地址 —— 而**构建不会报错**，
 * 只有真去看 sitemap 内容才会发现。
 * 同一件事有两份实现，迟早会分叉；共用一份就没有这个空间。
 */
const toUrl = toAbsoluteUrl;

/** sitemap 要求 W3C 日期格式（YYYY-MM-DD） */
function toDateOnly(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(contentDir, relativePath), 'utf8')) as T;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function readProjectSlugs(): string[] {
  return readdirSync(join(contentDir, 'projects'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

function buildEntries(): SitemapEntry[] {
  const posts = readJson<PostIndexShape>('posts-index.json').posts.filter((post) => !post.draft);

  // 最新的文章日期用于 posts 列表页的 lastmod
  const newestPostDate =
    posts
      .map((post) => toDateOnly(post.updated ?? post.date))
      .sort()
      .at(-1) ?? today();

  /**
   * 静态页面。
   *
   * `priority` 只是给爬虫的相对重要度提示（不影响排名），
   * `changefreq` 同理 —— 它们都是"建议"，不是指令。
   * 真正有用的是 `lastmod`：它让爬虫知道内容是否更新过。
   */
  const staticPages: SitemapEntry[] = [
    { path: '/', lastmod: today(), changefreq: 'weekly', priority: '1.0' },
    { path: '/about', lastmod: today(), changefreq: 'monthly', priority: '0.8' },
    { path: '/projects', lastmod: today(), changefreq: 'weekly', priority: '0.9' },
    { path: '/posts', lastmod: newestPostDate, changefreq: 'weekly', priority: '0.9' },
    { path: '/resume', lastmod: today(), changefreq: 'monthly', priority: '0.8' },
    { path: '/contact', lastmod: today(), changefreq: 'yearly', priority: '0.5' },
  ];

  const projectPages: SitemapEntry[] = readProjectSlugs().map((slug) => ({
    path: `/projects/${slug}`,
    lastmod: today(),
    changefreq: 'monthly',
    priority: '0.7',
  }));

  // 文章详情：lastmod 优先用 frontmatter 的 updated
  const postPages: SitemapEntry[] = posts.map((post) => ({
    path: `/posts/${post.slug}`,
    lastmod: toDateOnly(post.updated ?? post.date),
    changefreq: 'monthly',
    priority: '0.7',
  }));

  return [...staticPages, ...projectPages, ...postPages];
}

function buildSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(toUrl(entry.path))}</loc>`,
        `    <lastmod>${entry.lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');

  // 注意 sitemaps.org 是复数形式 —— 写成 sitemap.org 是无效命名空间
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

function buildRobots(): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# 构建产物不需要被抓取（文件名带 hash，抓了也没有意义）',
    `Disallow: ${BASE_PREFIX}assets/`,
    '',
    `Sitemap: ${toUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function main(): void {
  const entries = buildEntries();

  if (!existsSync(distDir)) {
    console.error('找不到 dist/。build-seo 必须在 vite build **之后**运行。');
    process.exit(1);
  }

  const sitemapPath = join(distDir, 'sitemap.xml');
  const robotsPath = join(distDir, 'robots.txt');

  writeFileSync(sitemapPath, buildSitemap(entries), 'utf8');
  writeFileSync(robotsPath, buildRobots(), 'utf8');

  console.log(`已写入 ${relative(repoRoot, sitemapPath)}`);
  console.log(`已写入 ${relative(repoRoot, robotsPath)}`);
  console.log(`  sitemap 共 ${entries.length} 条 URL，站点地址 ${SITE_ORIGIN}`);
}

main();
