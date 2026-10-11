/**
 * 文章路由的 loader。
 *
 * 与作品集详情同理：数据在渲染前就绪，组件里不需要 loading 分支。
 * 文章这里多一层价值 —— 正文是懒加载的 MDX 组件，
 * 若放在组件里用 useEffect 加载，就得自己管理 loading / error 状态；
 * 交给 loader 后这些分支全部消失。
 *
 * 元数据来自构建期生成的 content/posts-index.json（同步读取，已按日期倒序），
 * 只有正文组件需要异步加载。
 */
import { createElement, type ReactElement } from 'react';

import { loadPostComponent, postMetas, type PostMeta } from '@/lib/content';

/** 标签聚合，按出现频次降序 */
function collectTags(posts: readonly PostMeta[]): string[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/** 文章列表：过滤草稿 + 标签聚合 */
export function postsListLoader() {
  const visible = postMetas.filter((post) => !post.draft);

  return { posts: visible, tags: collectTags(visible) };
}

export interface PostDetailData {
  meta: PostMeta;
  /**
   * 正文内容（**已创建的 React 元素**，不是组件类型）。
   *
   * ## 为什么是元素而不是组件
   *
   * 直觉写法是让 loader 返回 MDX 组件本身，页面里写 `<Content />`。
   * 但 React Router 的 useLoaderData 在此版本处理「数据里含组件类型」时，
   * 会把该属性推断成不可用类型（实测依次得到 `never`、
   * 以及缺少 children 的 ReactElement）。loader 自身的返回类型是正确的，
   * 退化发生在 hook 的类型变换里。
   *
   * 改成在 loader 里就把元素创建好 —— 类型变成普通对象，不经过任何
   * 组件类型的推断，页面侧稳定可用。代价仅是正文创建时机从渲染时提前到
   * loader 返回时，对本项目没有实质影响。
   */
  content: ReactElement;
  /** 上一条 / 下一条，用于阅读导航 */
  prev: PostMeta | null;
  next: PostMeta | null;
}

/** 文章详情：元数据 + 正文元素 + 前后篇导航 */
export async function postDetailLoader({
  params,
}: {
  params: Record<string, string | undefined>;
}): Promise<PostDetailData> {
  const slug = params['slug'];

  if (slug === undefined) {
    throw new Response('缺少文章标识', { status: 400, statusText: 'Bad Request' });
  }

  const meta = postMetas.find((item) => item.slug === slug);

  if (meta === undefined) {
    throw new Response(`找不到文章「${slug}」`, { status: 404, statusText: 'Not Found' });
  }

  const Content = await loadPostComponent(slug);

  if (Content === undefined) {
    throw new Response(`找不到文章正文「${slug}」`, { status: 404, statusText: 'Not Found' });
  }

  // postMetas 已按日期倒序，所以 index - 1 是更新的文章
  const index = postMetas.indexOf(meta);

  return {
    meta,
    content: createElement(Content),
    prev: postMetas[index - 1] ?? null,
    next: postMetas[index + 1] ?? null,
  };
}
