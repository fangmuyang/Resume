import { z } from 'zod';

import { dateRangeSchema, urlSchema } from './primitives';

/** 教育经历 */
export const educationItemSchema = z.object({
  school: z.string().min(1),
  major: z.string().min(1),
  degree: z.string().min(1),
  period: dateRangeSchema,
  /** 主修课程，为空表示不展示 */
  courses: z.array(z.string().min(1)).default([]),
  /** 学业排名，如「专业前 5%」，没有则为 null */
  rank: z.string().min(1).nullable().default(null),
  /** 其他学业亮点（不是奖项类，奖项统一放 resume.awards） */
  highlights: z.array(z.string().min(1)).default([]),
});

export type EducationItem = z.infer<typeof educationItemSchema>;

/**
 * 简历里的项目条目（概览级）。
 * 与 content/projects/*.json 的区别：
 * - 这里的 project 是简历版的一句话描述，服务「简历页 / 首页精选」
 * - projects/*.json 是完整案例（背景、方案、难点、成果），服务「作品集详情页」
 * 两者用 slug 关联，slug 不需要每个都存在于 projects/ 下（早期项目可能没有详情）。
 */
export const resumeProjectSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  period: dateRangeSchema,
  tech: z.array(z.string().min(1)).default([]),
  /** 简历正文里的条目化描述 */
  bullets: z.array(z.string().min(1)).min(1),
  /** 线上地址，没有则为 null */
  url: urlSchema.nullable().default(null),
});

export type ResumeProject = z.infer<typeof resumeProjectSchema>;

/** 一份完整简历 */
export const resumeSchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  education: z.array(educationItemSchema).min(1),
  projects: z.array(resumeProjectSchema).min(1),
  awards: z.array(z.string().min(1)).default([]),
});

export type Resume = z.infer<typeof resumeSchema>;
