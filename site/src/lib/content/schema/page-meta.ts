import { z } from 'zod';

/**
 * 各页面的 SEO 文案。
 *
 * ## 为什么单独一个文件
 *
 * 页面标题与描述是**给搜索引擎和社交平台看的文案**，
 * 需要反复推敲，而且很可能由非开发者调整。
 * 把它们放在内容管道里而不是组件代码里，理由有三：
 *
 * 1. **可编辑**：改文案不需要动代码、不需要重新理解组件结构；
 * 2. **可校验**：长度限制（搜索引擎对标题与描述有最佳长度）
 *    由 schema 强制，而不是靠人记；
 * 3. **不违反零硬编码约定**：`pnpm verify:content` 会检查组件里
 *    是否出现内容库中的字符串 —— 如果文案写在组件里，它就应该被移到内容里。
 */
export const pageMetaSchema = z.object({
  /** 页面标题（不含站点名后缀，由 SEO 组件拼接） */
  title: z.string().min(1).max(40, '页面标题建议不超过 40 字'),
  /**
   * 页面描述。
   *
   * 长度限制不是随意的：搜索引擎结果页一般显示 150–160 字，
   * 超出部分会被截断，太短则浪费展示空间。
   * 这里放宽到 160 以适应中文（一个汉字约占两个字符宽度）。
   */
  description: z.string().min(10).max(160, '页面描述建议不超过 160 字'),
});

export type PageMeta = z.infer<typeof pageMetaSchema>;

/** 全部页面的 SEO 文案，键为路由标识 */
export const pageMetaCollectionSchema = z.object({
  home: pageMetaSchema,
  about: pageMetaSchema,
  projects: pageMetaSchema,
  posts: pageMetaSchema,
  resume: pageMetaSchema,
  contact: pageMetaSchema,
  notFound: pageMetaSchema,
  /**
   * 路由错误页（loader 抛出的 4xx）。
   *
   * 与 notFound 分开：`notFound` 是"路由没匹配上"，
   * 这里是"路由匹配上了但数据不存在"（例如项目 slug 拼错）。
   * 两者对用户的意义不同，标题也该不同。
   */
  error: pageMetaSchema,
});

export type PageMetaCollection = z.infer<typeof pageMetaCollectionSchema>;
