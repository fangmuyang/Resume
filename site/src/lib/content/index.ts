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
import type { Profile, Project, Resume, SkillGroup } from './schema';

/**
 * eager + import:'default' 把 JSON 解析成对象并内联进产物，没有运行时请求。
 * 路径相对本文件：src/lib/content/ → 上溯四级到仓库根，再进 content/。
 */
const globbed = import.meta.glob('../../../../content/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

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

// 类型再导出，方便组件只从 '@/lib/content' 一个入口取类型
export type { Profile, Project, Resume, SkillGroup };
