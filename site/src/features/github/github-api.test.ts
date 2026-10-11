/**
 * GitHub 客户端测试。
 *
 * ## 为什么优先测这里
 *
 * 这个模块的复杂度集中在**失败路径**：四种错误分类、响应结构的手写解析、
 * 限流头部的读取。而且它刚刚从 Zod 换成了手写类型守卫 ——
 * 换掉了"别人写的、被广泛验证过的"解析逻辑，换成了自己写的，
 * 这是最需要测试覆盖的时刻。
 *
 * ## 测试策略
 *
 * 用 MSW 在网络层拦截，而不是 mock `fetch`。
 * 这样测的是**真实请求路径**：URL 拼错、请求头漏了、状态码处理不对，
 * 都能被发现。如果 mock fetch 本身，这些都会被掩盖。
 */
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  GithubApiError,
  fetchGithubRepositories,
  selectDisplayRepositories,
  type GithubRepository,
} from '@/features/github/github-api';
import { githubHandlers, mockRepository } from '@/test/msw-handlers';
import { server } from '@/test/msw-server';

const API_BASE = 'https://api.github.com';

/** 造一条类型完整的仓库对象，用于纯函数测试 */
function repo(overrides: Partial<GithubRepository> = {}): GithubRepository {
  return {
    id: 1,
    name: 'repo',
    html_url: 'https://github.com/u/repo',
    description: null,
    language: null,
    stargazers_count: 0,
    topics: [],
    fork: false,
    archived: false,
    pushed_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('fetchGithubRepositories', () => {
  it('成功时返回解析后的仓库与限流信息', async () => {
    server.use(
      ...githubHandlers({
        repositories: [
          { name: 'alpha', stargazers_count: 3, language: 'TypeScript' },
          { name: 'beta', stargazers_count: 7 },
        ],
      }),
    );

    const result = await fetchGithubRepositories('someone');

    expect(result.repositories).toHaveLength(2);
    expect(result.repositories[0]?.name).toBe('alpha');
    expect(result.repositories[1]?.name).toBe('beta');
    // 限流信息来自响应头，用于界面提示
    expect(result.rateLimitRemaining).toBe(59);
    expect(result.rateLimitLimit).toBe(60);
  });

  it('把请求发到正确的 URL', async () => {
    // 专门断言 URL：用户名拼错是这类代码最常见的 bug，
    // 而 mock fetch 的做法根本测不到这一点
    let requestedUrl = '';
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json([], { headers: { 'x-ratelimit-remaining': '59' } });
      }),
    );

    await fetchGithubRepositories('fangmuyang');

    expect(requestedUrl).toContain('/users/fangmuyang/repos');
    expect(requestedUrl).toContain('per_page=100');
  });

  it('带上传给 GitHub 要求的请求头', async () => {
    let accept: string | null = null;
    let apiVersion: string | null = null;

    server.use(
      http.get(`${API_BASE}/users/:username/repos`, ({ request }) => {
        accept = request.headers.get('accept');
        apiVersion = request.headers.get('x-github-api-version');
        return HttpResponse.json([]);
      }),
    );

    await fetchGithubRepositories('someone');

    // GitHub 要求 Accept 带版本化媒体类型，否则可能拿到旧结构
    expect(accept).toContain('application/vnd.github+json');
    expect(apiVersion).toBe('2022-11-28');
  });

  it('404 抛 not-found', async () => {
    server.use(...githubHandlers({ notFound: true }));

    await expect(fetchGithubRepositories('nobody')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('403 且额度归零时抛 rate-limited，并带出重置时间', async () => {
    server.use(...githubHandlers({ rateLimited: true }));

    const error = await fetchGithubRepositories('someone').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubApiError);
    expect((error as GithubApiError).kind).toBe('rate-limited');
    // 重置时间用于告诉用户"还要等多久"，缺了它这个错误就没有可操作性
    expect((error as GithubApiError).resetAt).toBeInstanceOf(Date);
  });

  it('响应不是数组时抛 invalid-response', async () => {
    server.use(...githubHandlers({ malformed: true }));

    await expect(fetchGithubRepositories('someone')).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('响应是非空数组但一条都解析不出来时抛 invalid-response', async () => {
    // 这是"接口改了字段名"的典型表现：数组还在，但结构完全不同。
    // 如果静默返回空列表，用户会以为是"这个账号没有仓库"。
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () =>
        HttpResponse.json([{ unexpected: true }, { also: 'wrong' }]),
      ),
    );

    await expect(fetchGithubRepositories('someone')).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('部分条目结构异常时只丢弃异常条目，不让整个列表失败', async () => {
    // 这是"过度严格"的反例：API 加了一个格式怪异的条目时，
    // 用户应该还能看到其余正常仓库，而不是整块报错。
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () =>
        HttpResponse.json([
          { id: 1, name: 'good', html_url: 'https://github.com/u/good' },
          { id: 'not-a-number', name: 'bad', html_url: 'https://github.com/u/bad' },
          { name: 'missing-id', html_url: 'https://github.com/u/missing' },
        ]),
      ),
    );

    const result = await fetchGithubRepositories('someone');

    expect(result.repositories).toHaveLength(1);
    expect(result.repositories[0]?.name).toBe('good');
  });

  it('可选字段缺失时给默认值而不是 undefined', async () => {
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () =>
        HttpResponse.json([{ id: 1, name: 'minimal', html_url: 'https://github.com/u/m' }]),
      ),
    );

    const result = await fetchGithubRepositories('someone');
    const repository = result.repositories[0];

    expect(repository?.description).toBeNull();
    expect(repository?.language).toBeNull();
    expect(repository?.stargazers_count).toBe(0);
    expect(repository?.topics).toEqual([]);
    expect(repository?.fork).toBe(false);
  });

  it('topics 里的非字符串会被过滤掉', async () => {
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () =>
        HttpResponse.json([
          {
            id: 1,
            name: 'r',
            html_url: 'https://github.com/u/r',
            topics: ['keep', 42, null, 'also-keep'],
          },
        ]),
      ),
    );

    const result = await fetchGithubRepositories('someone');

    expect(result.repositories[0]?.topics).toEqual(['keep', 'also-keep']);
  });

  it('网络故障抛 network', async () => {
    server.use(http.get(`${API_BASE}/users/:username/repos`, () => HttpResponse.error()));

    await expect(fetchGithubRepositories('someone')).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

describe('selectDisplayRepositories', () => {
  it('排除 fork 与归档仓库', () => {
    const result = selectDisplayRepositories(
      [
        repo({ id: 1, name: 'normal' }),
        repo({ id: 2, name: 'forked', fork: true }),
        repo({ id: 3, name: 'archived', archived: true }),
      ],
      10,
    );

    expect(result.map((item) => item.name)).toEqual(['normal']);
  });

  it('按 star 数降序，star 相同时按最近提交时间', () => {
    const result = selectDisplayRepositories(
      [
        repo({ id: 1, name: 'few-stars', stargazers_count: 1 }),
        repo({ id: 2, name: 'many-stars', stargazers_count: 100 }),
        repo({
          id: 3,
          name: 'same-stars-newer',
          stargazers_count: 5,
          pushed_at: '2025-06-01T00:00:00Z',
        }),
        repo({
          id: 4,
          name: 'same-stars-older',
          stargazers_count: 5,
          pushed_at: '2024-01-01T00:00:00Z',
        }),
      ],
      10,
    );

    expect(result.map((item) => item.name)).toEqual([
      'many-stars',
      'same-stars-newer',
      'same-stars-older',
      'few-stars',
    ]);
  });

  it('按 limit 截断', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      repo({ id: index, name: `repo-${index}` }),
    );

    expect(selectDisplayRepositories(many, 3)).toHaveLength(3);
  });

  it('不修改传入数组的顺序', () => {
    // 排序前做了浅拷贝。若直接 sort 原数组，调用方的数据会被静默改动 ——
    // 这类副作用很难排查。
    const original = [
      repo({ id: 1, name: 'a', stargazers_count: 1 }),
      repo({ id: 2, name: 'b', stargazers_count: 9 }),
    ];

    selectDisplayRepositories(original, 10);

    expect(original.map((item) => item.name)).toEqual(['a', 'b']);
  });
});

describe('mockRepository 辅助函数', () => {
  it('默认产出结构完整的仓库，可被客户端解析', async () => {
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () =>
        HttpResponse.json([mockRepository({ name: 'custom' })]),
      ),
    );

    const result = await fetchGithubRepositories('someone');

    expect(result.repositories[0]?.name).toBe('custom');
  });
});
