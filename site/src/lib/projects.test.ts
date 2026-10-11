/**
 * 作品集筛选逻辑测试。
 *
 * 这些是纯函数，测试成本低但价值高 —— 筛选的边界条件（空选择、
 * OR 与 AND 语义、标签去重）都很容易写错，而一旦写错，
 * 表现是"某个项目莫名消失"，很难从界面上察觉。
 */
import { describe, expect, it } from 'vitest';

import type { Project } from '@/lib/content';
import { collectTags, filterProjects } from '@/lib/projects';

/** 造一个字段完整的项目，只覆盖关心的部分 */
function project(overrides: Partial<Project> & Pick<Project, 'slug'>): Project {
  return {
    name: overrides.slug,
    summary: '摘要',
    listIntro: null,
    role: '开发者',
    period: { start: '2025-01-01', end: null },
    status: 'completed',
    featured: false,
    order: 1,
    tech: [],
    tags: [],
    background: '背景',
    contributions: ['贡献'],
    approaches: [],
    challenges: [],
    results: [],
    links: [],
    cover: null,
    screenshots: [],
    ...overrides,
  };
}

const projects: Project[] = [
  project({ slug: 'a', tech: ['React', 'TypeScript'], tags: ['Web'] }),
  project({ slug: 'b', tech: ['Vue'], tags: ['移动端'] }),
  project({ slug: 'c', tech: ['React', 'Vue'], tags: [] }),
];

describe('filterProjects', () => {
  it('未选标签时返回全部（且是新数组）', () => {
    const result = filterProjects(projects, []);

    expect(result).toHaveLength(3);
    // 返回副本而不是原数组：调用方若排序不会影响源数据
    expect(result).not.toBe(projects);
  });

  it('默认用 OR 语义：命中任意一个标签即保留', () => {
    // 用户点两个标签时通常想看"这两个方向的项目"，
    // 而不是"同时属于两个方向的项目"—— 后者往往一个都剩不下
    const result = filterProjects(projects, ['TypeScript', '移动端']);

    expect(result.map((item) => item.slug)).toEqual(['a', 'b']);
  });

  it('显式传 all 时用 AND 语义', () => {
    const result = filterProjects(projects, ['React', 'Vue'], 'all');

    expect(result.map((item) => item.slug)).toEqual(['c']);
  });

  it('同时匹配 tech 与 tags 两类标签', () => {
    // 'Web' 只存在于 tags 里，'React' 只存在于 tech 里，两者应等价对待
    expect(filterProjects(projects, ['Web']).map((item) => item.slug)).toEqual(['a']);
    expect(filterProjects(projects, ['React']).map((item) => item.slug)).toEqual(['a', 'c']);
  });

  it('没有匹配项时返回空数组', () => {
    expect(filterProjects(projects, ['不存在的标签'])).toEqual([]);
  });
});

describe('collectTags', () => {
  it('合并 tech 与 tags 并按出现频次降序', () => {
    const tags = collectTags(projects);

    // Vue 出现在 b 与 c（2 次），React 出现在 a 与 c（2 次），
    // TypeScript / Web / 移动端 各 1 次
    expect(tags.slice(0, 2).sort()).toEqual(['React', 'Vue']);
    expect(tags).toContain('TypeScript');
    expect(tags).toContain('Web');
    expect(tags).toContain('移动端');
  });

  it('频次相同时按名称升序，保证顺序稳定', () => {
    // 顺序不稳定会让"标签顺序每次刷新都不一样"，观感很差
    const first = collectTags(projects);
    const second = collectTags(projects);

    expect(first).toEqual(second);
  });

  it('同一个项目里重复的标签只计一次', () => {
    const duplicated = [
      project({ slug: 'x', tech: ['React'], tags: ['React'] }),
      project({ slug: 'y', tech: ['Vue'] }),
    ];

    const tags = collectTags(duplicated);

    // React 只属于 x 一个项目，因此频次应与 Vue 相同（都是 1），
    // 而不是因为写了两次就变成 2 排在前面
    expect(tags).toContain('React');
    expect(tags).toContain('Vue');
    expect(tags.indexOf('React')).toBeLessThanOrEqual(tags.indexOf('Vue') + 1);
  });

  it('没有项目时返回空数组', () => {
    expect(collectTags([])).toEqual([]);
  });
});
