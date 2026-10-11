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
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BASE_PATH, SITE_URL } from '../src/lib/seo/site-config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const contentDir = join(projectRoot, 'content');
const publicDir = join(projectRoot, 'public');

interface PostIndexShape {
  posts: { slug: string; date: string; updated: string | null; draft: boolean }[];
}

interface SitemapEntry {
  path: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: string;
}

/** 拼成绝对 URL，保证路径之间只有一个斜杠 */
function toUrl(path: string): string {
  const trimmed = path === '/' ? '' : path.replace(/^\/+|\/+$/g, '');
  return `${SITE_URL}${BASE_PATH}${trimmed === '' ? '/' : `/${trimmed}`}`;
}

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
    `Disallow: ${BASE_PATH}/assets/`,
    '',
    `Sitemap: ${toUrl('/sitemap.xml')}`,
    '',
  ].join('\n');
}

function main(): void {
  const entries = buildEntries();

  const sitemapPath = join(publicDir, 'sitemap.xml');
  const robotsPath = join(publicDir, 'robots.txt');

  writeFileSync(sitemapPath, buildSitemap(entries), 'utf8');
  writeFileSync(robotsPath, buildRobots(), 'utf8');

  console.log(`已写入 ${relative(repoRoot, sitemapPath)}`);
  console.log(`已写入 ${relative(repoRoot, robotsPath)}`);
  console.log(`  sitemap 共 ${entries.length} 条 URL`);
}

main();
