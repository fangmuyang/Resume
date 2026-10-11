/**
 * MSW handlers：在测试与开发环境里拦截 GitHub API。
 *
 * ## MSW 解决的是什么问题
 *
 * 测试一个会发网络请求的组件，传统做法有三种，都有明显缺陷：
 *
 * | 做法 | 问题 |
 * | --- | --- |
 * | mock `fetch` / `axios` | 替换了实现细节。组件换了请求方式就要重写测试，而且测不到 URL、请求头、状态码处理 |
 * | 打桩整个模块 | 同上，而且会连"请求发没发出去"都测不到 |
 * | 打真实网络 | 慢、不稳定、依赖第三方可用性、有额度限制 |
 *
 * MSW 走的是第四种：**在网络层拦截**（Node 里用拦截器，浏览器里用 Service Worker）。
 * 组件代码完全不知道 mock 存在 —— 它照样 `fetch`，照样拿到 Response。
 * 因此测的是真实请求路径：URL 拼错、请求头漏了、状态码处理不对，都能被发现。
 *
 * ## 默认行为要覆盖哪些
 *
 * 这里不只提供"成功"的 handler。失败路径才是这个功能的主要复杂度所在
 * （见 github-api.ts 的错误分类），所以 404、限流、结构异常都有对应的 handler。
 *
 * ## 为什么 handlers 只提供给测试用
 *
 * 当前没有让开发环境也接管网络 —— 那会让人分不清"看到的是真实数据还是 mock"。
 * 如果以后需要，在 `src/main.tsx` 里按 `import.meta.env.DEV` 启用即可。
 */
import { http, HttpResponse } from 'msw';

const API_BASE = 'https://api.github.com';

/** 一条结构完整的仓库数据，字段与 github-api.ts 的解析逻辑对齐 */
export interface MockRepositoryOverrides {
  id?: number;
  name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number;
  topics?: string[];
  fork?: boolean;
  archived?: boolean;
  pushed_at?: string;
}

/** 造一条仓库数据，只覆盖关心的字段 */
export function mockRepository(overrides: MockRepositoryOverrides = {}): Record<string, unknown> {
  return {
    id: 1,
    name: 'example-repo',
    html_url: 'https://github.com/example/example-repo',
    description: '一个示例仓库',
    language: 'TypeScript',
    stargazers_count: 0,
    topics: [],
    fork: false,
    archived: false,
    pushed_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

/** 默认限流响应头：额度充足 */
const HEALTHY_RATE_LIMIT = {
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': '59',
  'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
};

export interface GithubHandlersOptions {
  /** 返回的仓库列表 */
  repositories?: Record<string, unknown>[];
  /** 为 true 时返回 404 */
  notFound?: boolean;
  /** 为 true 时返回限流响应（403 + 额度归零） */
  rateLimited?: boolean;
  /** 为 true 时返回结构异常的数据（用于测试 invalid-response 分支） */
  malformed?: boolean;
}

/**
 * 生成一组 handlers。
 *
 * 做成工厂函数而不是固定导出：不同测试用例需要不同行为，
 * 而 MSW 的正确用法是**每个测试用 `server.use(...)` 覆盖**，
 * 手写内联 handler 容易把 URL 拼错，反而让测试变脆。
 */
export function githubHandlers(options: GithubHandlersOptions = {}) {
  const {
    repositories = [mockRepository({ name: 'repo-alpha', stargazers_count: 5 })],
    notFound = false,
    rateLimited = false,
    malformed = false,
  } = options;

  return [
    /**
     * 注意 handler 签名里没有解构 `params` —— 这里不需要按用户名分支，
     * 而多一个未使用的参数会触发 noUnusedParameters。
     * 需要断言"URL 里的用户名正确"时，用 req.params 或检查 request.url 即可。
     */
    http.get(`${API_BASE}/users/:username/repos`, () => {
      if (notFound) {
        return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
      }

      if (rateLimited) {
        return HttpResponse.json(
          { message: 'API rate limit exceeded' },
          {
            status: 403,
            headers: {
              'x-ratelimit-limit': '60',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 120),
            },
          },
        );
      }

      if (malformed) {
        // 非数组：客户端应报 invalid-response，而不是崩溃
        return HttpResponse.json({ unexpected: 'shape' }, { headers: HEALTHY_RATE_LIMIT });
      }

      return HttpResponse.json(
        repositories.map((repo, index) => mockRepository({ id: index + 1, ...repo })),
        { headers: HEALTHY_RATE_LIMIT },
      );
    }),
  ];
}

/** 最常用的默认 handlers，供 setup 文件直接使用 */
export const defaultHandlers = githubHandlers();
