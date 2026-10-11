import { z } from 'zod';

import { isoDateSchema } from './primitives';

/**
 * 文章的 frontmatter（MDX 文件顶部的 YAML 元数据）。
 *
 * ## 为什么这个 schema 和别的内容 schema 分开校验
 *
 * 内容里的 JSON（profile / resume / skills / projects）在**构建期**校验后，
 * 数据原样内联进产物，类型靠 content-guard 插件保证。
 *
 * 文章的正文是 MDX，必须由 `@mdx-js/rollup` 编译成 React 组件，
 * 而编译产物里带着 frontmatter 导出。如果沿用「运行时校验」的思路，
 * Zod 又会被打进浏览器产物 —— 这与阶段 1 定下的取舍矛盾。
 *
 * 所以文章走一条独立的构建期路径（scripts/validate-content.ts 里实现）：
 * 用 gray-matter 解析 frontmatter → Zod 校验 → 只把校验后的元数据用于列表与 SEO。
 * 正文组件本身不需要 Zod。
 */
export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  /** 摘要，用于列表卡片与 meta description */
  summary: z.string().min(1),
  /** 发布日期 */
  date: isoDateSchema,
  /** 最后更新日期，没有则为 null */
  updated: isoDateSchema.nullable().default(null),
  /** 分类标签，用于站内搜索与聚合 */
  tags: z.array(z.string().min(1)).min(1, '至少要有 1 个标签'),
  /**
   * 是否为示范内容。
   * 本项目里有几篇由脚手架生成的示范文章，标记后可以在页面上区分，
   * 也方便你日后批量清理。
   */
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>;

/**
 * 校验后的文章元数据。
 *
 * 这些字段是**构建期**算出来的，会落盘到 content/posts-index.json，
 * 浏览器侧直接读取 —— 不需要在运行时解析 frontmatter 或统计字数。
 */
export interface PostMeta extends PostFrontmatter {
  /** 文件名（不含扩展名），即 URL 里的 slug */
  slug: string;
  /** 预计阅读分钟数，由正文实际字数估算 */
  readingMinutes: number;
}

/**
 * 文章索引。
 *
 * 由 `pnpm build:posts-index` 在构建期从 MDX 的 frontmatter 生成，
 * 落盘到 content/posts-index.json 并纳入版本控制。
 *
 * ## 为什么需要这个中间产物
 *
 * 浏览器侧拿不到文章的原始文本 —— MDX 已被 @mdx-js/rollup 编译成 React 组件。
 * 而列表页需要标题、日期、标签、阅读时长这些元数据。
 *
 * 两条路都走不通：
 * - 运行时读取 MDX 导出的 frontmatter：那样就得在浏览器里用 Zod 校验，Zod 会被打进产物；
 * - 用 `?raw` 再读一次源文件：MDX 插件会把那段原始文本也当代码编译，
 *   文章里的代码示例（含 import 语句）会被 Rollup 当成真实导入而报错。
 *
 * 所以元数据在构建期算好、落盘成 JSON，浏览器侧只读 JSON ——
 * 这与项目既有的「内容预生成」思路一致。
 */
export const postIndexSchema = z.object({
  posts: z.array(
    postFrontmatterSchema.extend({
      slug: z.string().min(1),
      readingMinutes: z.number().int().positive(),
    }),
  ),
});

export type PostIndex = z.infer<typeof postIndexSchema>;
