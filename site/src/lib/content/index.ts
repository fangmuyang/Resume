/**
 * 内容加载器。
 *
 * 数据流：
 *   content/*.json
 *     → 构建期：vite.config.ts 的 content-guard 插件用 Zod 校验，失败即中断构建
 *     → import.meta.glob（Vite 静态收集，JSON 内联进产物）
 *     → 推导出的 TS 类型
 *
 * 为什么这里**不做**运行时校验（一个值得记住的取舍）：
 * 校验只在构建期有意义。若把它也放进应用代码，Zod 和全部 schema 都会被打进
 * 浏览器产物 —— 实测 gzip 从 70 KB 涨到 101 KB，而这些代码在运行时永远不会
 * 拒绝任何数据（构建期已经拦住了）。所以 Zod 是 devDependency。
 *
 * 代价：如果内容绕过 content-guard 插件被内联（例如换成别的构建工具），
 * 这里不会报错。本项目所有构建都走 `pnpm build`，该风险可接受。
 */
import type { PostMeta, Profile, Project, Resume, SkillGroup } from './schema';

/**
 * eager + import:'default' 把 JSON 解析成对象并内联进产物，没有运行时请求。
 * 路径相对本文件：src/lib/content/ → 上溯四级到仓库根，再进 content/。
 */
const globbed = import.meta.glob('../../../content/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

/**
 * 文章用**非 eager** 的 glob：MDX 会被编译成 React 组件，
 * 每篇都不小（含代码高亮产物），全部内联进主包会拖慢首屏。
 *
 * `import: '*'` 拿到整个模块命名空间，其中 default 是文章正文组件。
 *
 * 注意：**元数据不从这里取**。frontmatter 导出的对象没有经过 Zod 校验，
 * 若在运行时校验就得把 Zod 打进产物。元数据统一走构建期生成的
 * content/posts-index.json（见 schema/post.ts 的说明）。
 */
const postModules = import.meta.glob<{
  default: React.ComponentType;
}>('../../../content/posts/*.mdx', { import: '*' });

/** glob 的 key 是绝对风格路径，这里归一化成 content/ 下的相对路径 */
function toContentRelativePath(key: string): string | undefined {
  return key.split('/content/')[1];
}

const entries = new Map<string, unknown>();

for (const [key, value] of Object.entries(globbed)) {
  const relativePath = toContentRelativePath(key);
  if (relativePath !== undefined) entries.set(relativePath, value);
}

function requireEntry(fileName: string): unknown {
  const value = entries.get(fileName);

  if (value === undefined) {
    throw new Error(`找不到内容文件 content/${fileName}。请先运行 \`pnpm extract\` 生成内容。`);
  }

  return value;
}

/**
 * import.meta.glob 不保留 JSON 的结构类型（返回 unknown），
 * 所以这里断言到 schema 推导出的类型。
 *
 * 这个断言的安全性由构建期的 content-guard 插件保证 ——
 * 它是"类型来自运行时校验"这一链条里唯一的单点，因此必须存在。
 */
export const profile = requireEntry('profile.json') as Profile;

export const resume = requireEntry('resume.json') as Resume;

export const skillGroups = requireEntry('skills.json') as SkillGroup[];

/** 按 order 升序、再按名称排序，保证渲染顺序稳定 */
function byOrderThenName(a: Project, b: Project): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-Hans-CN');
}

export const projects = [...entries.keys()]
  .filter((path) => path.startsWith('projects/'))
  .sort()
  .map((path) => requireEntry(path) as Project)
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
 * 文章元数据（含阅读时长），来自构建期生成的 content/posts-index.json。
 *
 * 为什么不读 MDX 模块导出的 frontmatter：那个对象没有经过 Zod 校验，
 * 运行时校验会把 Zod 打进产物；而用 `?raw` 读源文件又会让 MDX 插件
 * 把原始文本当代码编译。构建期生成索引是唯一干净的路子。
 */
const postIndex = requireEntry('posts-index.json') as { posts: PostMeta[] };

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
export type { PostMeta, Profile, Project, Resume, SkillGroup };
