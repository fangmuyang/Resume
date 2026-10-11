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

/**
 * 站点级 SEO 文案。
 *
 * 放在内容里的理由与 builtWith 相同：这些文字会随站点定位调整，
 * 而且它们**出现在搜索结果与社交分享卡片上** ——
 * 属于需要反复推敲的内容，不该埋在组件代码里。
 */
export const seoSchema = z.object({
  /** 站点名，用于 `<title>` 的「页面标题 · 站点名」形式 */
  siteName: z.string().min(1),
  /** index.html 里的默认描述，也是首页的 description */
  defaultDescription: z.string().min(1),
  /** 结构化数据里的站点描述 */
  websiteDescription: z.string().min(1),
  /** 语言代码，用于 `<html lang>` 与 JSON-LD 的 inLanguage */
  language: z.string().min(2),
  /** 书写方向，PWA manifest 需要 */
  direction: z.enum(['ltr', 'rtl']).default('ltr'),
  /**
   * PWA manifest 里的短名称。
   *
   * 与 siteName 分开是因为它出现在手机主屏图标下面 ——
   * 那里只能显示约 12 个字符，长了会被截断成省略号。
   */
  shortName: z.string().min(1).max(12, 'PWA 短名称建议不超过 12 个字符'),
  /** 浏览器地址栏 / 状态栏的主题色，应与品牌色一致 */
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, '主题色需为 #RRGGBB 格式'),
});

export type SeoConfig = z.infer<typeof seoSchema>;

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
  seo: seoSchema.default({
    siteName: '个人网站',
    defaultDescription: '个人网站：前端开发、项目作品与技术笔记',
    websiteDescription: '个人网站',
    language: 'zh-CN',
    direction: 'ltr',
    shortName: '个人网站',
    themeColor: '#4f46e5',
  }),
});

export type Profile = z.infer<typeof profileSchema>;
