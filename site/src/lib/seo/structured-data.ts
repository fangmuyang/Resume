/**
 * JSON-LD 结构化数据的构建函数。
 *
 * ## 为什么和 Seo 组件分开放
 *
 * 这些函数返回普通对象，不是 React 组件。
 * 放在 `.tsx` 组件文件里会触发 `react-refresh/only-export-components` ——
 * Fast Refresh 只有在"文件只导出组件"时才能可靠工作，
 * 混入普通函数会让它退回整页刷新，开发体验变差。
 *
 * ## 结构化数据解决什么问题
 *
 * 普通 meta 标签告诉搜索引擎"这页大概讲什么"，
 * 而 JSON-LD 用 schema.org 词汇明确声明**实体与关系**：
 * 这是一个人、他有哪些技能、这些文章是他写的。
 * 搜索引擎据此可以生成富摘要（rich result），而不是一行普通链接。
 *
 * ## 为什么用 JSON-LD 而不是微数据
 *
 * 微数据要把属性嵌进 HTML 标签（`itemprop="name"`），
 * 会把语义混进展示结构；JSON-LD 是独立的一段脚本，
 * 与页面结构解耦，也更容易从内容数据生成。
 */
import { profile } from '@/lib/content';
import { SITE_ORIGIN, toAbsoluteUrl } from '@/lib/seo/site-config';

/** 站点级结构化数据：描述"这是一个个人网站" */
export function buildWebsiteStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: profile.seo.siteName,
    description: profile.seo.websiteDescription,
    url: SITE_ORIGIN,
    inLanguage: profile.seo.language,
    author: {
      '@type': 'Person',
      name: profile.name,
      url: SITE_ORIGIN,
    },
  };
}

/** 个人资料结构化数据：用于关于页 */
export function buildPersonStructuredData(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    ...(profile.aka === null ? {} : { alternateName: profile.aka }),
    description: profile.bio,
    url: SITE_ORIGIN,
    jobTitle: profile.headline,
    // sameAs 声明"这些外部账号是同一个人"。只挑可验证的个人主页，
    // 邮箱与电话不属于这个语义（那是 contactPoint 的范畴）。
    sameAs: profile.links
      .filter((link) => link.kind === 'github' || link.kind === 'website')
      .map((link) => link.value),
  };
}

/** 文章结构化数据：用于文章详情页 */
export function buildArticleStructuredData(input: {
  title: string;
  description: string;
  path: string;
  publishedTime: string;
  updatedTime: string | null;
  tags: readonly string[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    url: toAbsoluteUrl(input.path),
    datePublished: input.publishedTime,
    // 只有真正更新过才带 dateModified。带一个等于发布时间的"更新时间"
    // 是错误信息，会让搜索引擎误判内容的时效性。
    ...(input.updatedTime === null ? {} : { dateModified: input.updatedTime }),
    keywords: input.tags.join(', '),
    inLanguage: profile.seo.language,
    author: {
      '@type': 'Person',
      name: profile.name,
      url: SITE_ORIGIN,
    },
  };
}
