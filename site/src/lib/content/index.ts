/**
 * 内容加载器。
 *
 * ## 数据流
 *
 * ```
 * content/*.json          源头（可能含私密字段）
 *   → 构建期脚本生成净化副本 / 索引（build-public-content / build-posts-index）
 *   → 构建期 Zod 校验（validate-content + vite 插件 content-guard）
 *   → import.meta.glob 内联进产物
 *   → 本模块给出类型安全的数据
 * ```
 *
 * ## 两条重要的设计决定
 *
 * **一、浏览器读的是净化副本，不是源头。**
 * `profile.json` 含手机号等私密字段。最初的做法是"组件里按 privacy 开关决定
 * 是否渲染"，但实测被 `pnpm verify:privacy` 拦下：数据在 bundle 里，
 * 渲染与否无关紧要，打开 DevTools 就能搜到。
 * 条件渲染只能决定"显示什么"，不能决定"传输什么"。
 *
 * **二、每个文件用精确的 glob，不用 `content/**\/*.json`。**
 * 通配 glob 会把它匹配到的**所有**文件内联进产物 —— 包括不该公开的源文件。
 * 这是一次真实的教训：隐私边界必须在"哪些文件进入产物"这一层划定。
 * 代价是新增内容文件时要同步 PUBLIC_ENTRY_MODULES，这个显式约束是值得的。
 */
import type {
  EnumLabels,
  PageMeta,
  PageMetaCollection,
  PostMeta,
  Profile,
  Project,
  Resume,
  ResumeAsset,
  SkillGroup,
} from './schema';

/**
 * 公开条目：每个文件单独 glob。
 *
 * WHY 不合并成一个 glob：合并就无法排除 `profile.json` 这类源头文件。
 */
const PUBLIC_ENTRY_MODULES = {
  profile: import.meta.glob('../../../content/profile-public.json', {
    eager: true,
    import: 'default',
  }),
  resume: import.meta.glob('../../../content/resume.json', { eager: true, import: 'default' }),
  skills: import.meta.glob('../../../content/skills.json', { eager: true, import: 'default' }),
  resumeAsset: import.meta.glob('../../../content/resume-asset.json', {
    eager: true,
    import: 'default',
  }),
  pageMeta: import.meta.glob('../../../content/page-meta.json', {
    eager: true,
    import: 'default',
  }),
  enumLabels: import.meta.glob('../../../content/enum-labels.json', {
    eager: true,
    import: 'default',
  }),
  projects: import.meta.glob('../../../content/projects/*.json', {
    eager: true,
    import: 'default',
  }),
  postIndex: import.meta.glob('../../../content/posts-index.json', {
    eager: true,
    import: 'default',
  }),
} as const;

/**
 * 文章正文：**非 eager**，MDX 会编译成含代码高亮的 React 组件，
 * 每篇都不小，全部内联进主包会拖慢首屏。
 */
const postModules = import.meta.glob<{ default: React.ComponentType }>(
  '../../../content/posts/*.mdx',
  { import: '*' },
);

/** 取某个 glob 的唯一结果；匹配数量不是 1 就报错，避免静默取到错误的文件 */
function singleEntry(modules: Record<string, unknown>, label: string): unknown {
  const values = Object.values(modules);

  if (values.length !== 1) {
    throw new Error(
      `内容文件 ${label} 匹配到 ${values.length} 个，期望 1 个。请检查 content/ 下的文件名。`,
    );
  }

  return values[0];
}

/**
 * 断言的说明：`import.meta.glob` 不保留 JSON 的结构类型，
 * 所以这里把结果断言到 schema 推导出的类型。
 * 这个断言的安全性由构建期的 content-guard 插件保证（它用同一套 Zod schema 校验）。
 */
export const profile = singleEntry(PUBLIC_ENTRY_MODULES.profile, 'profile-public.json') as Profile;

export const resume = singleEntry(PUBLIC_ENTRY_MODULES.resume, 'resume.json') as Resume;

export const skillGroups = singleEntry(PUBLIC_ENTRY_MODULES.skills, 'skills.json') as SkillGroup[];

/** 简历 PDF 等公开资产的声明（文件名、标签、体积） */
export const resumeAsset = singleEntry(
  PUBLIC_ENTRY_MODULES.resumeAsset,
  'resume-asset.json',
) as ResumeAsset;

/** 各页面的 SEO 文案（标题与描述） */
export const pageMeta = singleEntry(
  PUBLIC_ENTRY_MODULES.pageMeta,
  'page-meta.json',
) as PageMetaCollection;

/**
 * 枚举值的展示标签。
 *
 * 数据模型用英文枚举（`completed` / `job`）保证稳定，
 * 界面上的中文来自这里 —— 所以组件里不该再出现 `{ completed: '已完成' }` 这类映射。
 */
export const enumLabels = singleEntry(
  PUBLIC_ENTRY_MODULES.enumLabels,
  'enum-labels.json',
) as EnumLabels;

/** 按 order 升序、再按名称排序，保证渲染顺序稳定 */
function byOrderThenName(a: Project, b: Project): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-Hans-CN');
}

export const projects = Object.values(PUBLIC_ENTRY_MODULES.projects)
  .map((value) => value as Project)
  .sort(byOrderThenName);

/** 首页精选：由数据里的 featured 决定，而不是靠数组下标 */
export const featuredProjects = projects.filter((project) => project.featured);

/** 作品集筛选用的全部技术标签，按使用频次降序 */
export const allTechTags = (() => {
  const counts = new Map<string, number>();

  for (const project of projects) {
    for (const tech of project.tech) {
      counts.set(tech, (counts.get(tech) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
})();

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

// ---------------- 文章 ----------------

/** slug → 懒加载函数。slug 取自文件名，是构建期唯一可靠的标识 */
export const postModulesBySlug: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(postModules).map(([path, loader]) => [
    (path.split('/').pop() ?? path).replace(/\.mdx$/, ''),
    loader,
  ]),
);

/**
 * 文章元数据（含阅读时长），来自构建期生成的 posts-index.json。
 *
 * 为什么不读 MDX 模块导出的 frontmatter：那个对象没有经过 Zod 校验，
 * 运行时校验会把 Zod 打进产物；而用 `?raw` 读源文件又会让 MDX 插件
 * 把原始文本当代码编译。构建期生成索引是唯一干净的路子。
 */
const postIndex = singleEntry(PUBLIC_ENTRY_MODULES.postIndex, 'posts-index.json') as {
  posts: PostMeta[];
};

/** 全部文章元数据，已按日期倒序（排序在构建期完成） */
export const postMetas: PostMeta[] = postIndex.posts;

/** 加载单篇文章的正文组件；slug 不存在时返回 undefined */
export async function loadPostComponent(slug: string): Promise<React.ComponentType | undefined> {
  const loader = postModulesBySlug[slug];
  if (loader === undefined) return undefined;

  const module = (await loader()) as { default: React.ComponentType };
  return module.default;
}

/** 全部文章标签，按出现频次降序 */
export const postTags: string[] = (() => {
  const counts = new Map<string, number>();

  for (const meta of postMetas) {
    for (const tag of meta.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
})();

// 类型再导出，方便组件只从 '@/lib/content' 一个入口取类型
export type {
  PageMeta,
  PageMetaCollection,
  PostMeta,
  Profile,
  Project,
  Resume,
  ResumeAsset,
  SkillGroup,
};
