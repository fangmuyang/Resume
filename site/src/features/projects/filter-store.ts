/**
 * 作品集筛选状态。
 *
 * ## 为什么 URL 是真相来源，不放进 Zustand
 *
 * 筛选状态有三个硬需求：可分享链接、刷新后保持、浏览器后退可用。
 * 这三件事本质上是「状态要存在于 URL 里」。
 *
 * 如果把筛选状态只放在客户端 store 里，就得自己实现 history 同步，
 * 而且很容易和浏览器的前进后退行为打架（典型症状：按后退键筛选没跟着变）。
 * 所以这里直接用 React Router 的 useSearchParams 作为唯一状态源 ——
 * **能用 URL 表达的状态就不要复制到客户端 store**。
 *
 * Zustand 在本项目的两个落地点是主题与搜索面板开关，
 * 那些状态确实无法（也不需要）用 URL 表达。
 *
 * ## 一个容易忽略的细节：replace 而不是 push
 *
 * 切换标签时如果用默认的 push，每点一次筛选就多一条历史记录。
 * 用户连点五个标签后按后退，要按五次才能离开这个页面 —— 体验很差。
 * 所以这里统一用 `{ replace: true }`。
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { TagMatchMode } from '@/lib/projects';

/** 查询参数名 */
export const TAGS_PARAM = 'tags';

/**
 * 匹配模式参数。
 *
 * ## 为什么需要它
 *
 * `filterProjects` 从一开始就支持两种语义（`'any'` = OR，`'all'` = AND），
 * 但 store 只暴露了 OR —— 也就是说 AND 分支**没有入口**，
 * 是一段无法被触达的代码。E2E 用例写 `?match=all` 时才发现这一点。
 *
 * 那种"选了多个标签后一个结果都不剩"的困惑，正确答案是让用户
 * 自己选择语义，而不是替他决定。所以把它接到 URL 上。
 *
 * ## 为什么默认是 any
 *
 * 用户点两个标签时，通常想"看这两个方向的内容"（并集）；
 * 而 AND 更常用于"在已有结果里继续收窄"。
 * 默认值应与最常见的意图一致。
 */
export const MATCH_PARAM = 'match';

/** 解析匹配模式；除显式的 all 之外一律按 any 处理（对错误输入更宽容） */
export function parseMatchMode(value: string | null): TagMatchMode {
  return value === 'all' ? 'all' : 'any';
}

/** 解析 'a,b,c' → ['a','b','c']，去掉空值与重复项 */
export function parseTags(value: string | null): string[] {
  if (value === null) return [];

  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    ),
  ];
}

/** 序列化标签数组 → 'a,b'。空数组返回 null，以便把参数从 URL 中移除 */
export function serializeTags(tags: readonly string[]): string | null {
  return tags.length === 0 ? null : tags.join(',');
}

/** 切换某个标签：已选中则移除，未选中则加入 */
export function toggleTag(tags: readonly string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
}

export interface ProjectFilter {
  /** 当前选中的标签（技术栈与领域标签混合） */
  selectedTags: string[];
  /** 多标签时的匹配语义：any = 任一命中，all = 全部命中 */
  matchMode: TagMatchMode;
  /** 是否处于筛选状态 */
  isFiltering: boolean;
  toggle: (tag: string) => void;
  /** 切换匹配语义 */
  setMatchMode: (mode: TagMatchMode) => void;
  clear: () => void;
}

export function useProjectFilter(): ProjectFilter {
  const [searchParams, setSearchParams] = useSearchParams();

  // 直接以 URL 为唯一依据，不在组件里留副本 —— 两份状态迟早会不一致
  const selectedTags = useMemo(() => parseTags(searchParams.get(TAGS_PARAM)), [searchParams]);
  const matchMode = useMemo(() => parseMatchMode(searchParams.get(MATCH_PARAM)), [searchParams]);

  const toggle = useCallback(
    (tag: string) => {
      const next = toggleTag(selectedTags, tag);
      const params = new URLSearchParams(searchParams);
      const serialized = serializeTags(next);

      if (serialized === null) {
        params.delete(TAGS_PARAM);
        // 标签清空后匹配语义已无意义，一并移除，避免 URL 里留下悬空参数
        params.delete(MATCH_PARAM);
      } else {
        params.set(TAGS_PARAM, serialized);
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, selectedTags, setSearchParams],
  );

  const setMatchMode = useCallback(
    (mode: TagMatchMode) => {
      const params = new URLSearchParams(searchParams);

      if (mode === 'any') {
        // 默认值不进 URL：让链接尽量短，也让"默认"只有一个定义处
        params.delete(MATCH_PARAM);
      } else {
        params.set(MATCH_PARAM, mode);
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete(TAGS_PARAM);
    params.delete(MATCH_PARAM);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    selectedTags,
    matchMode,
    isFiltering: selectedTags.length > 0,
    toggle,
    setMatchMode,
    clear,
  };
}
