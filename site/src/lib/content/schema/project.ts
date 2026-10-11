import { z } from 'zod';

import { dateRangeSchema, urlSchema } from './primitives';

/** 项目状态：用于作品集页筛选 */
export const projectStatusSchema = z.enum(['active', 'completed', 'archived']);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const linkSchema = z.object({
  label: z.string().min(1),
  href: urlSchema,
});

export type ContentLink = z.infer<typeof linkSchema>;

/**
 * 作品集详情。
 *
 * 设计取舍：技术栈用结构化的 tech 数组而不是自由文本，
 * 因为作品集页要按标签筛选 —— 自由文本没法可靠地做分类。
 */
export const projectSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 必须是 kebab-case，例如 smart-elderly-care'),
  name: z.string().min(1),
  /** 一句话简介，用于卡片 */
  summary: z.string().min(1),
  /**
   * 作品集**列表页**的引导语。
   * 只允许在一个项目上设置（通常是第一个），列表页取到它作为页面描述。
   * 放在内容里而不是写死在页面组件中：页面文案必须来自 content/，
   * 这条约定由 pnpm verify:content 强制检查。
   */
  listIntro: z.string().min(1).nullable().default(null),
  role: z.string().min(1),
  period: dateRangeSchema,
  status: projectStatusSchema,
  /**
   * 是否在首页精选。用显式布尔而不是"取前 3 个"，
   * 这样调整顺序不必改动首页代码。
   */
  featured: z.boolean().default(false),
  /** 展示顺序，数字小的在前 */
  order: z.number().int().nonnegative().default(99),
  /** 使用的技术，作为筛选标签 */
  tech: z.array(z.string().min(1)).default([]),
  /** 可选的业务/领域标签，如「智慧养老」「医疗」 */
  tags: z.array(z.string().min(1)).default([]),
  /** 背景与目标 */
  background: z.string().min(1),
  /** 我负责的部分 */
  contributions: z.array(z.string().min(1)).min(1),
  /** 技术方案要点 */
  approaches: z.array(z.string().min(1)).default([]),
  /** 难点与解决方式 */
  challenges: z.array(z.string().min(1)).default([]),
  /** 成果，尽量可量化 */
  results: z.array(z.string().min(1)).default([]),
  links: z.array(linkSchema).default([]),
  /**
   * 配图路径（相对 public/）。
   * 留空时详情页需要优雅降级为纯文字版式。
   */
  cover: z.string().nullable().default(null),
  screenshots: z.array(z.string().min(1)).default([]),
});

export type Project = z.infer<typeof projectSchema>;
