/**
 * 站点级 SEO 配置。
 *
 * ## 为什么集中在一个文件
 *
 * `siteUrl` 与 `basePath` 被多处使用：canonical 链接、Open Graph、
 * JSON-LD、sitemap.xml、robots.txt、manifest。
 * 如果每处各写一遍，改域名时必然漏掉某几处 ——
 * 而"canonical 指向旧域名"是 SEO 上很隐蔽的问题，不会报错，只会掉排名。
 *
 * ## 与 vite.config.ts 的 base 必须一致
 *
 * `basePath` 是 `base` 去掉尾部斜杠的形式。两处如果不同步，
 * canonical 与 sitemap 里的链接就会与实际部署路径不符。
 * `scripts/verify-build.ts` 会检查这一点。
 */

/** 部署后的站点根地址，不带尾部斜杠 */
export const SITE_URL = 'https://fangmuyang.github.io';

/**
 * 仓库名。
 *
 * GitHub Pages 的**项目站点**地址是 https://<user>.github.io/<repo>/，
 * 所以这个名字同时决定了 Vite 的 `base`、PWA 的 `scope` / `start_url`、
 * canonical 链接与 sitemap 里的路径前缀。
 *
 * 只在这里定义一次：`vite.config.ts` 也从这里导入。
 * 如果两处各写一遍，改仓库名时必然漏掉某一处 ——
 * 而"canonical 指向旧路径"不会报错，只会静默地让 SEO 失效。
 */
export const REPO_NAME = 'resume';

/** 仓库名决定的子路径 */
export const BASE_PATH = `/${REPO_NAME}`;

/** 完整的站点地址，例如 https://fangmuyang.github.io/resume */
export const CANONICAL_ORIGIN = `${SITE_URL}${BASE_PATH}`;

/**
 * 把站内路由转成绝对 URL。
 *
 * 相对路径在 canonical / OG 里是无效的 —— 这些标签要求绝对地址。
 * 这里统一处理，避免每个页面各自拼接时漏掉斜杠或重复斜杠。
 */
export function toAbsoluteUrl(routePath: string): string {
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;

  // 根路径要保留一个斜杠；其余路径去掉尾部斜杠避免出现 `//`
  const trimmed = normalized === '/' ? '/' : normalized.replace(/\/+$/, '');

  return `${CANONICAL_ORIGIN}${trimmed}`;
}
