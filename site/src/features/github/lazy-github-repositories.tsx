import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';

import { createQueryClient } from '@/lib/query-client';

/**
 * GitHub 仓库区块 + 它自己的 Query Provider。
 *
 * ## 为什么 Provider 不放在应用根部
 *
 * 直觉做法是在 `main.tsx` 里用 `QueryClientProvider` 包住整个应用。
 * 但那样的话 **TanStack Query 会进入主包** —— 实测主 chunk 因此从
 * 94 KB 涨到 175 KB，而全站只有"项目"页里的一个区块用到它。
 *
 * 把 Provider 放进这个懒加载边界后：
 * - 只有渲染「开源仓库」区块时才下载 Query 与查询代码；
 * - 其他所有页面完全不加载它们，主包回落到约 95 KB。
 *
 * 代价是这段边界必须自包含：不能说"别的页面也会用到 Query"，
 * 否则这个优化立刻失效。目前没有这种页面，所以成立。
 *
 * ## QueryClient 在懒加载模块内创建
 *
 * 它随这个 chunk 一起加载，天然只有一份 —— 不会因为组件重渲染而重建，
 * 也不会在测试之间共享缓存（每个挂载点建一个）。
 */
const GithubRepositoriesSection = lazy(async () => {
  const module = await import('@/features/github/github-repositories');
  return { default: module.GithubRepositories };
});

export interface LazyGithubRepositoriesProps {
  username: string;
  limit: number;
}

export function LazyGithubRepositories({ username, limit }: LazyGithubRepositoriesProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense
        // 骨架屏的尺寸与真实卡片接近，加载完成时不会发生明显布局跳动
        fallback={
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: Math.min(limit, 4) }, (_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        }
      >
        <GithubRepositoriesSection username={username} limit={limit} />
      </Suspense>
    </QueryClientProvider>
  );
}
