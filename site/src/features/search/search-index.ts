/**
 * 站内搜索索引。
 *
 * ## 设计要点
 *
 * **一、索引在模块加载时构建一次，不在每次输入时重建。**
 * Fuse 的核心价值是提前把数据变成可快速检索的结构（构建倒排索引）。
 * 如果每次按键都 `new Fuse(...)`，就等于每次重新索引一遍全站内容 ——
 * 数据量一大立刻卡顿。所以这里在模块顶层创建一次，之后只调用 `search()`。
 *
 * **二、所有内容类型统一成同一种条目结构。**
 * 项目、文章、技能、页面在数据模型上完全不同，但"搜索"只关心
 * 标题、描述、标签和跳转目标。把它们映射成同一个 `SearchEntry`，
 * 界面就不需要为每种类型写一套渲染逻辑。
 *
 * **三、权重按字段区分，而不是给所有字段相同权重。**
 * 搜"React"时，标题里含 React 的项目应该排在描述里提到 React 的文章前面。
 * Fuse 的 `weight` 就是干这个的。
 */
import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js';

import { postMetas, profile, projects, resume, skillGroups } from '@/lib/content';
import { NAV_ITEMS } from '@/lib/navigation';

/** 搜索结果的类型：决定图标与次要信息怎么渲染 */
export type SearchEntryKind = 'project' | 'post' | 'skill' | 'page';

export interface SearchEntry {
  /** 全局唯一 id，用 `${kind}:${slug}` 形式，避免不同集合的 slug 撞车 */
  id: string;
  kind: SearchEntryKind;
  title: string;
  description: string;
  /** 参与检索但不一定展示的关键词（技术栈、标签等） */
  keywords: string[];
  /** 点击后跳转的路由 */
  href: string;
}

/** 类型对应的中文标签，用于结果分组显示 */
export const SEARCH_KIND_LABEL: Record<SearchEntryKind, string> = {
  project: '项目',
  post: '文章',
  skill: '技能',
  page: '页面',
};

function buildEntries(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  // ---- 页面 ----
  for (const item of NAV_ITEMS) {
    entries.push({
      id: `page:${item.to}`,
      kind: 'page',
      title: item.label,
      description: `${profile.name} 的${item.label}页面`,
      keywords: [],
      href: item.to,
    });
  }

  // ---- 项目 ----
  for (const project of projects) {
    entries.push({
      id: `project:${project.slug}`,
      kind: 'project',
      title: project.name,
      // 项目详情里的概要可能是待补充占位，这里用角色+技术栈兜底，避免搜索结果出现 "TODO:…"
      description: project.summary.startsWith('TODO:')
        ? `${project.role} · ${project.tech.join('、')}`
        : project.summary,
      keywords: [...project.tech, ...project.tags, project.role],
      href: `/projects/${project.slug}`,
    });
  }

  // ---- 文章 ----
  for (const meta of postMetas) {
    if (meta.draft) continue;

    entries.push({
      id: `post:${meta.slug}`,
      kind: 'post',
      title: meta.title,
      description: meta.summary,
      keywords: meta.tags,
      href: `/posts/${meta.slug}`,
    });
  }

  // ---- 技能 ----
  // 技能不是独立页面，所以跳到"关于我"的技能区块
  for (const group of skillGroups) {
    entries.push({
      id: `skill:${group.id}`,
      kind: 'skill',
      title: group.label,
      description: group.items.join('、'),
      keywords: group.items,
      href: '/about',
    });
  }

  // ---- 教育经历 ----
  for (const item of resume.education) {
    entries.push({
      id: `page:education:${item.school}`,
      kind: 'page',
      title: item.school,
      description: `${item.degree} · ${item.major}`,
      keywords: [...item.courses, item.rank ?? ''],
      href: '/resume',
    });
  }

  return entries;
}

/** 索引只构建一次（模块级常量） */
export const SEARCH_ENTRIES: SearchEntry[] = buildEntries();

const FUSE_OPTIONS: IFuseOptions<SearchEntry> = {
  // 字段权重：标题最重要，关键词次之，描述最后
  keys: [
    { name: 'title', weight: 3 },
    { name: 'keywords', weight: 2 },
    { name: 'description', weight: 1 },
  ],
  // 0 = 完全匹配，1 = 匹配一切。0.4 让"react"能搜到"React 19"但不至于召回无关内容
  threshold: 0.4,
  // 匹配位置要显示高亮，所以打开
  includeMatches: true,
  // 结果按权重排序
  ignoreLocation: true,
};

const fuse = new Fuse(SEARCH_ENTRIES, FUSE_OPTIONS);

export interface SearchHit {
  entry: SearchEntry;
  /** 命中的字段 → 命中的字符区间，用于标出高亮片段 */
  matches: readonly FuseResultMatch[];
}

/** 执行搜索；查询为空时返回空数组而不是全部条目 */
export function searchContent(query: string, limit = 12): SearchHit[] {
  const trimmed = query.trim();
  if (trimmed === '') return [];

  return fuse
    .search(trimmed, { limit })
    .map((result) => ({ entry: result.item, matches: result.matches ?? [] }));
}
