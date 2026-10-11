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

/**
 * 第三方集成的配置。
 *
 * 为什么放在内容里而不是写死在组件里：
 * 1. 账号名属于"事实"，会被零硬编码守卫拦下（见 scripts/verify-content-usage.ts）；
 * 2. 换账号、调展示条数不需要改代码，也不需要重新构建组件逻辑。
 *
 * 注意这里**只放公开信息**。任何令牌都不该写进内容文件 ——
 * 内容会被内联进产物，而产物是公开的。令牌走环境变量（见 src/vite-env.d.ts）。
 */
export const integrationsSchema = z.object({
  /** GitHub 用户名，用 GitHub REST API 拉取公开仓库 */
  githubUsername: z.string().min(1).nullable().default(null),
  /** 最多展示多少个仓库，避免列表过长 */
  githubRepoLimit: z.number().int().positive().max(30).default(6),
});

export type Integrations = z.infer<typeof integrationsSchema>;

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
  /**
   * Header 处品牌标识的两段文字，渲染成 `前缀.后缀` 的等宽字体样式。
   *
   * 拆成两段是因为样式不同（后缀带品牌色）。放进内容的原因与 builtWith 相同：
   * 它包含用户名这类事实，写死在组件里会被 verify:content 拦下。
   */
  brandMark: z
    .object({
      prefix: z.string().min(1),
      suffix: z.string().min(1),
    })
    .default({ prefix: 'portfolio', suffix: '.resume' }),
  links: z.array(socialLinkSchema).default([]),
  privacy: privacySchema.default({ showPhone: false, allowResumeDownload: true }),
  integrations: integrationsSchema.default({ githubUsername: null, githubRepoLimit: 6 }),
});

export type Profile = z.infer<typeof profileSchema>;
