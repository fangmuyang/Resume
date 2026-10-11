/**
 * 站点级 SEO 与部署配置。
 *
 * ## 为什么集中在一个文件
 *
 * `siteUrl` 与 `basePath` 被多处使用：canonical 链接、Open Graph、
 * JSON-LD、sitemap.xml、robots.txt、manifest、Vite 的 `base`、
 * PWA 的 `scope` / `start_url`。
 * 如果每处各写一遍，改域名时必然漏掉某几处 ——
 * 而"canonical 指向旧域名"是 SEO 上很隐蔽的问题，不会报错，只会静默掉排名。
 *
 * ## 一个环境变量同时决定 base 与绝对地址
 *
 * GitHub Pages 有两种部署形态，它们的**路径前缀不同**：
 *
 * | 形态 | 站点地址 | 资源前缀 |
 * | --- | --- | --- |
 * | 项目站点（默认） | https://fangmuyang.github.io/resume | `/resume/` |
 * | 自定义域名 | https://fangmu.online | `/` |
 *
 * 关键约束：**自定义域名部署时资源前缀必须是 `/`**。
 * 因为域名的根就是站点根，没有 `/resume/` 这一段 ——
 * 继续用 `/resume/` 会让所有资源 404、整站白屏。
 *
 * 而"站点地址"与"资源前缀"必须同时改变，否则 canonical 会指向一个
 * 资源加载不出来的地址。所以它们由**同一个变量**推导，
 * 而不是两个独立的配置项 —— 后者迟早会不同步。
 *
 * 用法：
 * ```bash
 * pnpm build                                        # 项目站点
 * VITE_SITE_URL=https://fangmu.online pnpm build    # 自定义域名
 * ```
 */

/** 推导结果：部署地址与路径前缀 */
export interface DerivedSiteConfig {
  /** 域名 + 路径前缀，不含尾部斜杠，例如 https://fangmuyang.github.io/resume */
  origin: string;
  /** 路径前缀，不含尾部斜杠（部署在域名根时为空字符串），例如 /resume */
  basePath: string;
  /** 路径前缀，含尾部斜杠，用于 PWA scope 这类需要目录语义的场合，例如 /resume/ */
  basePrefix: string;
}

/**
 * 从站点地址推导出路径前缀。
 *
 * 抽成纯函数是为了**能被直接测试**：这个推导我算错过多次
 * （多拼一次前缀导致 `…/resume/resume/`），
 * 而错误只在生成出来的文件内容里才看得出来。
 * 纯函数就能把各种形态固定下来，见同目录的 `site-config.test.ts`。
 */
export function deriveSiteConfig(siteUrl: string): DerivedSiteConfig {
  const origin = siteUrl.trim().replace(/\/+$/, '');

  const withoutProtocol = origin.replace(/^https?:\/\//, '');

  /**
   * 先剥掉 query / hash。
   * 环境变量里带 `?x=1` 很少见，但一旦出现，
   * 路径推导会把它们算进去，得到一个荒谬的前缀。
   */
  const pathOnly = withoutProtocol.split(/[?#]/)[0] ?? withoutProtocol;
  const firstSlash = pathOnly.indexOf('/');

  const basePath = firstSlash === -1 ? '' : pathOnly.slice(firstSlash).replace(/\/+$/, '');

  return {
    origin,
    basePath,
    basePrefix: basePath === '' ? '/' : `${basePath}/`,
  };
}

/**
 * 读取站点地址配置。
 *
 * ## 为什么要在两种环境下都能工作
 *
 * 这个模块同时被浏览器代码（`Seo` 组件、结构化数据）与 Node 脚本
 * （`build-seo`、`verify-seo`、`verify-build`）引用。
 *
 * - Vite 构建/开发时用 `import.meta.env`（Vite 在编译期把值替换成字面量，
 *   所以浏览器产物里没有这段逻辑）；
 * - Node（tsx）里 `import.meta.env` 是 **undefined** ——
 *   直接访问 `.VITE_SITE_URL` 会抛 `Cannot read properties of undefined`。
 */
function readSiteUrl(): string {
  /**
   * 判空时"空字符串也算未设置"。
   *
   * 这在 CI 里是**真实会发生的**：GitHub Actions 的 `${{ vars.SITE_URL }}`
   * 在变量未配置时展开为空字符串，而不是不传这个变量。
   * 如果用 `??` 判断，空字符串会被当成有效值 —— 于是 base 变成 `/`，
   * 部署到项目站点后所有资源 404、整站白屏。
   */
  const fromVite = (() => {
    if (typeof import.meta.env === 'undefined') return undefined;
    const value: unknown = import.meta.env.VITE_SITE_URL;
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
  })();

  if (fromVite !== undefined) return fromVite;

  const fromProcess = (() => {
    if (typeof process === 'undefined') return undefined;
    const value = process.env['VITE_SITE_URL'];
    return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
  })();

  if (fromProcess !== undefined) return fromProcess;

  /** 默认值：GitHub Pages 项目站点（域名 + 路径前缀的完整地址） */
  return 'https://fangmuyang.github.io/resume';
}

const derived = deriveSiteConfig(readSiteUrl());

/** 域名 + 路径前缀，不含尾部斜杠，例如 https://fangmu.online */
export const SITE_ORIGIN = derived.origin;

/**
 * 站点根路径，也就是 Vite 的 `base`。
 *
 * 空字符串表示"部署在域名根"，拼资源路径时要避免出现 `//`。
 */
export const BASE_PATH = derived.basePath;

/** 带尾部斜杠的前缀，用于 PWA scope / start_url / service worker 等需要目录语义的场合 */
export const BASE_PREFIX = derived.basePrefix;

/**
 * 把站内路由转成绝对 URL。
 *
 * 相对路径在 canonical / OG 里是无效的 —— 这些标签要求绝对地址。
 * 这里统一处理，避免每个页面各自拼接时漏掉斜杠或重复斜杠。
 *
 * 边界情况值得留意：`SITE_ORIGIN` 已经包含路径前缀
 * （`…github.io/resume`）。所以**绝不能再拼一次 `BASE_PREFIX`** ——
 * 那会得到 `…/resume/resume/`。拼接时只用 `SITE_ORIGIN` + 路由路径。
 */
export function toAbsoluteUrl(routePath: string): string {
  const trimmed = routePath.replace(/^\/+|\/+$/g, '');

  // 根路径保留尾部斜杠；其余路径不带尾部斜杠，避免 canonical 出现两种写法
  return trimmed === '' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${trimmed}`;
}

/**
 * 站内路由路径（不含 base）列表，用于生成 sitemap 与"每路由一个 HTML 入口"。
 *
 * 与 `src/app/router.tsx` 的静态路由保持一致 ——
 * 这里只列**可被直接访问**的路径，带参数的详情页由内容数据另外生成。
 */
export const STATIC_ROUTE_PATHS = [
  '/',
  '/about',
  '/projects',
  '/posts',
  '/resume',
  '/contact',
] as const;

/**
 * 把路由路径转成部署后的相对目录片段。
 *
 * 例：`/about` → `about`（在 `dist/` 下创建 `about/index.html`）。
 */
export function routeToOutputDir(routePath: string): string {
  return routePath.replace(/^\/+|\/+$/g, '');
}
