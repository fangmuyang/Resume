/**
 * 内容校验（纯函数，不依赖任何运行时环境）。
 *
 * 为什么要单独抽出来：内容需要**在两处**被校验，而它们运行在不同环境 ——
 * 1. 构建期：Vite 插件在 Node 侧读取文件并校验，**失败即中断构建**；
 * 2. 运行时：加载器校验内联进产物的数据，作为第二道防线。
 *
 * 两者共用这里的同一套 schema 与同一份规则，不会出现"校验标准不一致"。
 */
import {
  parseWithContext,
  profileSchema,
  projectSchema,
  resumeSchema,
  skillGroupsSchema,
  type Profile,
  type Project,
  type Resume,
  type SkillGroup,
} from './schema';

/** 内容文件在 content/ 目录下的相对路径。改文件名只需要改这里。 */
export const CONTENT_FILES = {
  profile: 'profile.json',
  resume: 'resume.json',
  skills: 'skills.json',
} as const;

/** 作品集详情放在这个子目录下，文件名即 slug */
export const PROJECTS_DIR = 'projects';

/**
 * 读取原始内容的函数签名。
 * 由调用方注入 —— 构建期用 fs 读，浏览器侧用 import.meta.glob 的结果。
 * 这样校验逻辑完全不需要知道自己跑在哪儿。
 */
export type ContentReader = (relativePath: string) => unknown;

export interface ValidatedContent {
  profile: Profile;
  resume: Resume;
  skillGroups: SkillGroup[];
  projects: Project[];
}

/** 按 order 升序、再按名称排序，保证渲染顺序稳定 */
function byOrderThenName(a: Project, b: Project): number {
  return a.order - b.order || a.name.localeCompare(b.name, 'zh-Hans-CN');
}

/** 校验单个作品集文件 */
export function validateProject(raw: unknown, source: string): Project {
  return parseWithContext(projectSchema, raw, source);
}

/**
 * 校验全部内容。
 *
 * 这里刻意不 try/catch：校验失败就应该让异常冒泡，
 * 构建期会让构建中断，运行时会直接抛错 —— 两类问题都不该被静默吞掉。
 */
export function validateAllContent(
  read: ContentReader,
  projectPaths: readonly string[],
): ValidatedContent {
  const profile = parseWithContext(
    profileSchema,
    read(CONTENT_FILES.profile),
    `content/${CONTENT_FILES.profile}`,
  );

  const resume = parseWithContext(
    resumeSchema,
    read(CONTENT_FILES.resume),
    `content/${CONTENT_FILES.resume}`,
  );

  const skillGroups = parseWithContext(
    skillGroupsSchema,
    read(CONTENT_FILES.skills),
    `content/${CONTENT_FILES.skills}`,
  );

  const projects = projectPaths.map((path) => validateProject(read(path), `content/${path}`));

  // slug 唯一性无法用单个文件内的 schema 表达，必须在集合层面检查 ——
  // 否则两个文件用同一个 slug 时，路由会静默地只显示其中一个。
  const duplicates = projects
    .map((project) => project.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);

  if (duplicates.length > 0) {
    throw new Error(`作品集 slug 重复：${[...new Set(duplicates)].join(', ')}`);
  }

  return { profile, resume, skillGroups, projects: [...projects].sort(byOrderThenName) };
}
