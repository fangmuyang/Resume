/**
 * 生成「每路由一个 HTML 入口」与 404 回退页。
 *
 *   pnpm build:prerender
 *
 * ## 解决什么问题
 *
 * 这是纯客户端渲染的 SPA 部署到静态托管时最实际的痛点：
 * 用户直接访问 `https://…/resume/about`（刷新页面、从分享链接进入、
 * 从搜索引擎点进来）时，服务器要找 `about/index.html` 这个文件 ——
 * 而 SPA 构建只产出根部的 `index.html`，于是返回 404。
 *
 * 修法是**为每个路由复制一份 index.html**：
 *
 * ```
 * dist/
 *   index.html            → /
 *   about/index.html      → /about
 *   projects/index.html   → /projects
 *   posts/index.html      → /posts
 *   resume/index.html     → /resume
 *   contact/index.html    → /contact
 *   projects/<slug>/index.html
 *   posts/<slug>/index.html
 *   404.html              → 兜底
 * ```
 *
 * 这样静态托管的默认行为（目录 → 该目录下的 index.html）就能正确响应，
 * 加载后客户端路由接管渲染。
 *
 * ## 必须说清的代价
 *
 * 这些 HTML **只有壳**：`<div id="root"></div>` 加资源引用，
 * 页面内容仍由 JavaScript 渲染。所以：
 *
 * - **执行 JavaScript 的爬虫**（Google、Bing）能拿到完整内容；
 * - **不执行 JavaScript 的爬虫**（多数社交平台预览抓取器）
 *   只会看到模板里的默认 title/description，拿不到当页的内容与元数据。
 *
 * 想彻底解决需要预渲染（构建时把 React 渲染成静态 HTML）或 SSR，
 * 那是架构变更，超出本项目范围。本脚本做的是**路由可达性与状态码**的正确性，
 * 不是内容预渲染 —— 这个区分很重要，不该含糊过去。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATIC_ROUTE_PATHS, routeToOutputDir } from '../src/lib/seo/site-config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const distDir = join(projectRoot, 'dist');
const contentDir = join(projectRoot, 'content');

/** 收集内容里带参数的详情页 slug，它们也需要各自的入口 */
function readDetailSlugs(): { projects: string[]; posts: string[] } {
  const projects = readdirSync(join(contentDir, 'projects'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();

  const postIndexPath = join(contentDir, 'posts-index.json');
  if (!existsSync(postIndexPath)) return { projects, posts: [] };

  // 草稿不该有可直接访问的入口 —— 它不该被搜索引擎或分享链接碰到
  const index = JSON.parse(readFileSync(postIndexPath, 'utf8')) as {
    posts: { slug: string; draft: boolean }[];
  };

  return {
    projects,
    posts: index.posts
      .filter((post) => !post.draft)
      .map((post) => post.slug)
      .sort(),
  };
}

function main(): void {
  const indexPath = join(distDir, 'index.html');

  if (!existsSync(indexPath)) {
    console.error('找不到 dist/index.html。请先运行 `pnpm build`（或先执行 vite build）。');
    process.exit(1);
  }

  const { projects, posts } = readDetailSlugs();

  /**
   * 需要生成入口的路径（不含 base）。
   *
   * 根路径不需要复制 —— `dist/index.html` 本身就是它的入口。
   */
  const routePaths = [
    ...STATIC_ROUTE_PATHS.filter((path) => path !== '/'),
    ...projects.map((slug) => `/projects/${slug}`),
    ...posts.map((slug) => `/posts/${slug}`),
  ];

  let created = 0;

  for (const routePath of routePaths) {
    const dir = routeToOutputDir(routePath);
    if (dir === '') continue;

    const targetDir = join(distDir, dir);
    mkdirSync(targetDir, { recursive: true });
    copyFileSync(indexPath, join(targetDir, 'index.html'));
    created += 1;
  }

  /**
   * 404.html 是**兜底**：处理上面没枚举到的路径
   * （拼错的地址、已删除的文章链接等）。
   *
   * 它同样复制 index.html 的内容，于是应用会加载起来并显示自己的
   * 「页面不存在」界面 —— 比托管商的默认 404 页友好得多。
   *
   * 注意：GitHub Pages 返回的 **HTTP 状态码仍是 404**。
   * 这是静态托管的限制（没有服务端重写），不是这里能绕过的。
   * 对个人站点来说这可以接受：状态码不完美，但用户看到的是正常界面。
   */
  copyFileSync(indexPath, join(distDir, '404.html'));

  console.log(`已生成每路由 HTML 入口（${relative(repoRoot, distDir)}）`);
  console.log(`  静态页 ${String(STATIC_ROUTE_PATHS.length - 1)} 个`);
  console.log(`  项目详情 ${String(projects.length)} 个`);
  console.log(`  文章详情 ${String(posts.length)} 个`);
  console.log(`  合计 ${String(created)} 个入口 + 1 个 404 回退页`);
}

main();
