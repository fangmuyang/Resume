/**
 * GitHub 仓库列表的查询。
 *
 * ## 为什么把 queryKey 和 queryFn 放在同一个模块
 *
 * queryKey 是"这份数据在缓存里的地址"。如果组件里各写各的字符串，
 * 很容易出现 `['repos']` 与 `['github-repos']` 这种拼写分叉 ——
 * 结果是同一个请求被缓存了两份、走了两条加载状态。
 * 集中定义就没有这个空间。
 *
 * ## queryKey 里的每一段都有含义
 *
 * TanStack Query 按 key 做**前缀匹配失效**：
 * - `['github']` → 所有 GitHub 相关查询；
 * - `['github', 'repos', username]` → 特定用户的仓库列表。
 *
 * 所以 `invalidateQueries({ queryKey: ['github'] })` 能一次性刷新全部，
 * 而这是靠 key 的结构实现的，不是靠额外配置。
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  fetchGithubRepositories,
  selectDisplayRepositories,
  type GithubRepository,
} from '@/features/github/github-api';

/** 缓存地址的唯一来源 */
export const githubQueryKeys = {
  all: ['github'] as const,
  repositories: (username: string) => [...githubQueryKeys.all, 'repos', username] as const,
};

export interface GithubRepositoriesData {
  /** 已按展示规则筛选并排序的仓库 */
  repositories: GithubRepository[];
  /** 仓库总数（筛选前），用于提示"共 N 个仓库" */
  totalCount: number;
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
}

/**
 * 拉取并筛选仓库列表。
 *
 * `username` 为 null 时不发请求（`enabled: false`）——
 * 这是 Query 很实用的一个能力：条件式查询。
 * 若用 useEffect 手写，就得自己管理"该不该发请求"以及随之而来的状态分支。
 */
export function useGithubRepositories(
  username: string | null,
  limit: number,
): UseQueryResult<GithubRepositoriesData> {
  return useQuery({
    queryKey: githubQueryKeys.repositories(username ?? ''),
    // username 为空时完全跳过请求，此时 query.status 是 'pending' 且 fetchStatus 为 'idle'
    enabled: username !== null,
    queryFn: async ({ signal }) => {
      // enabled 已保证 username 非空；这里断言是为了让 TS 在闭包里收窄
      const result = await fetchGithubRepositories(username as string, signal);

      return {
        repositories: selectDisplayRepositories(result.repositories, limit),
        totalCount: result.repositories.length,
        rateLimitRemaining: result.rateLimitRemaining,
        rateLimitLimit: result.rateLimitLimit,
      };
    },
  });
}
