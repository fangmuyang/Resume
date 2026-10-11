/**
 * 作品集相关的纯函数。
 *
 * 放在 lib/ 而不是组件里，是为了让这些规则能被直接测试（阶段 9 会用到），
 * 也避免组件文件同时导出组件与工具函数（会破坏 Fast Refresh）。
 */
import type { Project } from '@/lib/content';

/** 标签匹配策略：命中任意一个即算匹配（OR 语义） */
export type TagMatchMode = 'any' | 'all';

/**
 * 按标签筛选项目。
 *
 * 默认用 OR（"或"）：用户点两个标签时，通常想看的是"这两个方向的项目"，
 * 而不是"同时属于两个方向的项目"—— 后者往往一个都剩不下。
 * 需要 AND 语义时显式传 'all'。
 */
export function filterProjects(
  projects: readonly Project[],
  selectedTags: readonly string[],
  mode: TagMatchMode = 'any',
): Project[] {
  if (selectedTags.length === 0) return [...projects];

  return projects.filter((project) => {
    const projectTags = new Set([...project.tech, ...project.tags]);

    return mode === 'any'
      ? selectedTags.some((tag) => projectTags.has(tag))
      : selectedTags.every((tag) => projectTags.has(tag));
  });
}

/** 全部可选标签，按出现频次降序（高频的更适合放在前面引导点击） */
export function collectTags(projects: readonly Project[]): string[] {
  const counts = new Map<string, number>();

  for (const project of projects) {
    for (const tag of new Set([...project.tech, ...project.tags])) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/**
 * 把内容里记录的图片路径转成实际可用的 URL。
 *
 * **这里有个部署时才会暴露的坑。**
 * `base` 配置成 '/resume/' 后，构建产物里 Vite 处理的资源会自动带上前缀，
 * 但内容 JSON 里手写的 `/images/foo.png` 是字符串，Vite 不会碰它 ——
 * 直接当 src 用会请求 `https://example.com/images/foo.png`，在 GitHub Pages
 * 子路径部署下必然 404。
 *
 * 所以运行时拼接的绝对路径必须显式加上 BASE_URL。
 * 开发时 BASE_URL 是 '/'，生产是 '/resume/'，两边都正确。
 */
export function resolveAssetUrl(path: string | null): string | null {
  if (path === null || path === '') return null;

  // 完整外链不动
  if (/^https?:\/\//.test(path)) return path;

  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, '')}`;
}
