import { z } from 'zod';

import { urlSchema } from './primitives';

/**
 * 社交/联系链接。
 * 用 kind 区分用途，便于组件按类型选图标（GitHub 用图标，邮箱渲染成 mailto）。
 */
export const socialLinkSchema = z.object({
  kind: z.enum(['github', 'email', 'website', 'phone', 'qq', 'wechat']),
  label: z.string().min(1),
  value: urlSchema,
  /** 是否在页面上公开显示 */
  public: z.boolean().default(true),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

/**
 * 隐私开关。
 *
 * 这是本文件最重要的设计：简历 PDF 里含真实手机号，
 * 而站点是公开可爬的。把"哪些字段允许出现在网页上"变成**显式的数据**，
 * 而不是散落在组件里的判断 —— 这样发布前只需检查一处。
 */
export const privacySchema = z.object({
  /** 是否允许在网页正文显示手机号 */
  showPhone: z.boolean().default(false),
  /** 是否允许公开下载完整简历 PDF */
  allowResumeDownload: z.boolean().default(true),
});

export type Privacy = z.infer<typeof privacySchema>;

export const profileSchema = z.object({
  name: z.string().min(1),
  /** 别名/常用网名，没有则为 null */
  aka: z.string().min(1).nullable().default(null),
  headline: z.string().min(1),
  bio: z.string().min(1),
  location: z.string().min(1).nullable().default(null),
  /** 求职状态，如「寻找前端实习机会」，为空表示不展示 */
  availability: z.string().min(1).nullable().default(null),
  /** 头像路径（相对 public/） */
  avatar: z.string().min(1).nullable().default(null),
  /**
   * 页脚的「本站由 … 构建」说明。
   * 放进内容而不是写死在组件里：这类文字会随技术栈升级而过期，
   * 更适合当作可维护的数据。
   */
  builtWith: z.string().min(1).default('React + TypeScript'),
  links: z.array(socialLinkSchema).default([]),
  privacy: privacySchema.default({ showPhone: false, allowResumeDownload: true }),
});

export type Profile = z.infer<typeof profileSchema>;
