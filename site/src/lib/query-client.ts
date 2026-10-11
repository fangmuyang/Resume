/**
 * TanStack Query 的全局配置。
 *
 * ## 为什么本项目只需要 Query 这么小的一个落地点
 *
 * Query 解决的是"服务端状态的缓存与同步"。本站内容是构建期内联的，
 * 没有服务端状态 —— 所以只有 GitHub 仓库列表这一个真实用武之地。
 * 这也说明**不要为了用而用**：如果这个功能不存在，Query 就不该被引入。
 *
 * ## 每个默认值的理由
 *
 * | 配置 | 值 | 理由 |
 * | --- | --- | --- |
 * | staleTime | 10 分钟 | 仓库列表变化很慢，10 分钟内换页面不该重新请求 |
 * | gcTime | 30 分钟 | 超过 staleTime 后保留缓存，避免来回切换时闪 loading |
 * | refetchOnWindowFocus | false | 默认值是 true，但个人站不需要"切回标签页就刷新" |
 * | retry | 按错误类型 | 见下方说明 |
 *
 * ## retry 为什么不能简单地设成 3
 *
 * 不同错误的重试价值完全不同：
 * - 404：重试 100 次还是 404，纯粹浪费额度；
 * - 限流：重试会**消耗更多**额度，让情况更糟；
 * - 网络抖动：重试确实有用。
 *
 * 所以用函数形式按错误类型决定，并且做成指数退避（GitHub 官方建议）。
 */
import { QueryClient } from '@tanstack/react-query';

import { GithubApiError } from '@/features/github/github-api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,

        // 个人站点不需要"切回窗口就重新拉取"的默认行为
        refetchOnWindowFocus: false,

        retry: (failureCount, error) => {
          if (error instanceof GithubApiError) {
            // 这两类错误重试没有意义，甚至有害（限流时重试会消耗更多额度）
            if (error.kind === 'not-found' || error.kind === 'rate-limited') return false;
            // 结构不符说明是接口变更，重试也一样
            if (error.kind === 'invalid-response') return false;
          }

          // 网络类错误最多重试 2 次
          return failureCount < 2;
        },

        // 指数退避：1s、2s…上限 30s
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      },
    },
  });
}
