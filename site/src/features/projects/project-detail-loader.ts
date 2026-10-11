/**
 * 作品集详情页的 loader 与相关项目逻辑。
 *
 * 为什么不写在路由组件文件里：那个文件必须只导出组件，
 * 否则 React Fast Refresh 会退化成整页刷新。loader 是普通函数，放这里更干净。
 */
import { getProjectBySlug, projects, type Project } from '@/lib/content';
import { filterProjects } from '@/lib/projects';

/**
 * 详情页 loader。
 *
 * 用 React Router 的 loader 而不是在组件里 useParams + 查表，好处有两个：
 * 1. **数据在渲染前就绪**，组件里不需要 if (!project) 的分支，
 *    类型上也不必处理"可能还没加载"；
 * 2. 找不到项目时可以直接 `throw new Response(...)`，
 *    由根路由的错误边界渲染成 404 页 —— 这套错误传播机制是数据路由的核心价值。
 *
 * 目前内容是构建期内联的，loader 是同步的；以后换成真实 API 时，
 * 只要把这里改成 async 即可，组件代码不用动。
 */
export function projectDetailLoader({ params }: { params: Record<string, string | undefined> }) {
  const slug = params['slug'];

  if (slug === undefined) {
    throw new Response('缺少项目标识', { status: 400, statusText: 'Bad Request' });
  }

  const project = getProjectBySlug(slug);

  if (project === undefined) {
    throw new Response(`找不到项目「${slug}」`, { status: 404, statusText: 'Not Found' });
  }

  return { project, related: findRelatedProjects(project) };
}

/**
 * 找相关项目：优先按共享标签数量排序，只保留有交集的。
 *
 * 为什么不随机推荐：相关推荐的价值在于"看完这个可能想看那个"，
 * 随机推荐等于没有推荐。共享标签是最低成本的可靠信号。
 */
export function findRelatedProjects(project: Project, limit = 2): Project[] {
  const ownTags = new Set([...project.tech, ...project.tags]);

  const scored = projects
    .filter((candidate) => candidate.slug !== project.slug)
    .map((candidate) => {
      const candidateTags = [...candidate.tech, ...candidate.tags];
      const shared = candidateTags.filter((tag) => ownTags.has(tag)).length;
      return { candidate, shared };
    })
    .filter((item) => item.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.candidate.order - b.candidate.order);

  // 没有共享标签时退化为"取其余项目"，而不是显示空白区域
  if (scored.length === 0) {
    return filterProjects(projects, [], 'any')
      .filter((item) => item.slug !== project.slug)
      .slice(0, limit);
  }

  return scored.slice(0, limit).map((item) => item.candidate);
}
