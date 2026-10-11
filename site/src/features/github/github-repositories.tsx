import { FolderGit2, RefreshCw, Star } from 'lucide-react';

import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GithubApiError, type GithubErrorKind } from '@/features/github/github-api';
import { useGithubRepositories } from '@/features/github/use-github-repositories';
import { formatYearMonth } from '@/lib/format';

export interface GithubRepositoriesProps {
  username: string;
  limit: number;
}

/**
 * GitHub 仓库列表。
 *
 * ## 这个区块为什么值得存在（以及它的代价）
 *
 * 它是本项目里**唯一**的运行时数据请求 —— 其余内容都在构建期确定。
 * 引入它换来三样东西：
 * 1. TanStack Query 有了真实落地点（缓存、重试、条件查询）；
 * 2. MSW 有了可 mock 的真实网络边界；
 * 3. 一个必须正面处理的工程约束：**未认证的 GitHub API 只有 60 次/小时**。
 *
 * 代价也要说清楚：静态站点直连第三方 API 天然脆弱 ——
 * 额度和网络都可能出问题。所以下面的设计重点不是"怎么显示成功"，
 * 而是"失败时用户看到什么"。
 */
export function GithubRepositories({ username, limit }: GithubRepositoriesProps) {
  const query = useGithubRepositories(username, limit);

  // ---- 加载态：骨架屏而不是转圈 ----
  // 骨架屏的尺寸与真实内容一致，加载完成时不会发生布局跳动（CLS）
  if (query.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: Math.min(limit, 4) }, (_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800/60" />
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
              <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800/60" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ---- 错误态：按错误类型给出**可操作**的提示 ----
  if (query.isError) {
    return <GithubErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const { repositories, totalCount, rateLimitRemaining, rateLimitLimit } = query.data;

  if (repositories.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        该账号下没有可展示的公开仓库（已排除 fork 与归档仓库）。
      </p>
    );
  }

  // 额度低于 10 次时给出提醒：让用户知道"接下来可能会失败"，而不是突然看到错误
  const isRateLimitLow =
    rateLimitRemaining !== null && rateLimitRemaining > 0 && rateLimitRemaining <= 10;

  return (
    <div className="grid gap-4">
      <RevealList className="grid gap-4 sm:grid-cols-2">
        {repositories.map((repo) => (
          <RevealItem key={repo.id}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {/*
                    用 FolderGit2 而不是 GitHub 品牌图标：
                    lucide-react v1 移除了全部品牌图标（品牌标识另有授权要求）。
                    通用图标库本来就该只提供语义图标，这一点在选库时要留意。
                  */}
                  <FolderGit2 aria-hidden className="size-4 shrink-0 text-slate-500" />
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-brand-600 dark:hover:text-brand-500 truncate transition-colors"
                  >
                    {repo.name}
                  </a>
                </CardTitle>
              </CardHeader>

              <CardContent className="grid gap-3">
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {/* description 可能是 null，用占位文案而不是渲染成 undefined */}
                  {repo.description ?? '暂无描述'}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {repo.language !== null ? <Badge variant="outline">{repo.language}</Badge> : null}

                  {repo.stargazers_count > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Star aria-hidden className="size-3.5" />
                      {repo.stargazers_count}
                    </span>
                  ) : null}

                  <span className="font-mono">更新于 {formatYearMonth(repo.pushed_at)}</span>
                </div>

                {repo.topics.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {repo.topics.slice(0, 5).map((topic) => (
                      <Badge key={topic} variant="secondary">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </RevealItem>
        ))}
      </RevealList>

      <Reveal>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            共 {totalCount} 个公开仓库，展示最近更新的 {repositories.length} 个
          </span>

          {rateLimitRemaining !== null && rateLimitLimit !== null ? (
            <span className={isRateLimitLow ? 'text-amber-700 dark:text-amber-400' : undefined}>
              接口额度剩余 {rateLimitRemaining}/{rateLimitLimit}
            </span>
          ) : null}

          <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden className="size-3.5" />
            刷新
          </Button>

          {query.isFetching ? (
            <span aria-live="polite" className="text-slate-400">
              正在刷新…
            </span>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}

/**
 * 错误状态。
 *
 * 核心原则：**告诉用户能做什么**，而不是只说"失败了"。
 * 限流这类错误还要给出恢复时间 —— 否则用户只会反复刷新，让额度更紧张。
 */
function GithubErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const isKnownError = error instanceof GithubApiError;

  const hint = (() => {
    if (!isKnownError) return '发生了未知错误，可以尝试重试。';

    switch (error.kind) {
      case 'not-found':
        return '请检查站点配置里的 GitHub 用户名是否正确。';
      case 'rate-limited':
        return error.resetAt === null
          ? 'GitHub 未认证接口每小时限 60 次，请稍后再试。'
          : `GitHub 未认证接口每小时限 60 次，额度将在约 ${formatResetTime(error.resetAt)}后重置。`;
      case 'invalid-response':
        return '接口返回的数据结构有变化，重试无用，需要更新代码。';
      case 'network':
        return '网络请求失败，可以尝试重试。';
    }
  })();

  /**
   * 哪些错误不该给重试按钮。
   *
   * - `invalid-response`：接口结构变了，重试结果一样；
   * - `rate-limited`：**重试会消耗更多额度**，让用户等得更久。
   *
   * 第一版这里只排除了 `invalid-response`，漏了限流 ——
   * 于是界面上出现了"重新加载"按钮，用户点一次就多消耗一次额度。
   * 这是测试抓出来的真实缺陷，不是测试写错了。
   */
  const NON_RETRYABLE: readonly GithubErrorKind[] = ['invalid-response', 'rate-limited'];

  const canRetry = !isKnownError || !NON_RETRYABLE.includes(error.kind);

  return (
    <div className="grid justify-items-start gap-3 rounded-lg border border-dashed border-slate-300 p-6 dark:border-slate-700">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">暂时无法获取仓库列表</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{hint}</p>

      {canRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden className="size-3.5" />
          重新加载
        </Button>
      ) : null}
    </div>
  );
}

/** 把重置时间格式化成"X 分钟"或"X 小时" */
function formatResetTime(resetAt: Date): string {
  const minutes = Math.max(1, Math.round((resetAt.getTime() - Date.now()) / 60_000));
  return minutes >= 60 ? `${Math.ceil(minutes / 60)} 小时` : `${minutes} 分钟`;
}
