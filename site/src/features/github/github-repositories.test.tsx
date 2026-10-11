/**
 * GitHub 仓库区块的组件测试。
 *
 * ## 组件测试与纯函数测试的分工
 *
 * `github-api.test.ts` 测的是"数据解析对不对"；
 * 这里测的是"**用户能看到什么**"—— 四种状态各自的渲染结果。
 * 这两层不能互相替代：数据解析对了但渲染分支漏了，用户照样看到错误界面。
 *
 * ## QueryClient 每个用例新建
 *
 * Query 的缓存挂在 client 实例上。如果跨用例共享，
 * 第二个用例可能直接命中上一个用例的缓存，于是"没发请求"——
 * 断言看起来通过了，实际上什么都没验证。
 * 所以下面每个用例都通过 `renderWithQuery` 拿到干净的 client。
 */
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { GithubRepositories } from '@/features/github/github-repositories';
import { createQueryClient } from '@/lib/query-client';
import { githubHandlers, mockRepository } from '@/test/msw-handlers';
import { server } from '@/test/msw-server';

const API_BASE = 'https://api.github.com';

/**
 * 渲染并注入一个新的 QueryClient。
 *
 * 返回 client 本身，方便个别用例断言"确实发出了请求"（看缓存里有没有数据）。
 */
function renderWithQuery(ui: React.ReactElement): { client: QueryClient } & RenderResult {
  const client = createQueryClient();
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);

  return { client, ...result };
}

describe('GithubRepositories', () => {
  it('加载中先显示骨架屏', () => {
    // handler 永不响应，让组件停在 pending 状态
    server.use(http.get(`${API_BASE}/users/:username/repos`, () => new Promise(() => {})));

    const { container } = renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    // 骨架屏用 animate-pulse 标记，且此时不应出现任何仓库名
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('成功时渲染仓库卡片', async () => {
    server.use(
      ...githubHandlers({
        repositories: [
          { name: 'alpha', description: '第一个仓库', language: 'TypeScript' },
          { name: 'beta', description: null },
        ],
      }),
    );

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    const alphaLink = await screen.findByRole('link', { name: 'alpha' });
    expect(alphaLink.getAttribute('href')).toContain('github.com');
    expect(screen.getByRole('link', { name: 'beta' })).toBeInTheDocument();
  });

  it('仓库描述为 null 时显示占位文案而不是 undefined', async () => {
    server.use(...githubHandlers({ repositories: [{ name: 'no-desc', description: null }] }));

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    expect(await screen.findByText('暂无描述')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).toBeNull();
  });

  it('外部链接带 rel="noreferrer noopener"', async () => {
    // 少了 noopener，被打开的页面能通过 window.opener 操纵本站 —— 安全细节
    server.use(...githubHandlers({ repositories: [{ name: 'alpha' }] }));

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    const link = await screen.findByRole('link', { name: 'alpha' });
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('404 时提示检查用户名配置', async () => {
    server.use(...githubHandlers({ notFound: true }));

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    expect(await screen.findByText(/暂时无法获取仓库列表/)).toBeInTheDocument();
    // 错误提示必须**可操作**：告诉用户能做什么，而不是只说"失败了"
    expect(screen.getByText(/检查站点配置里的 GitHub 用户名/)).toBeInTheDocument();
  });

  it('限流时给出恢复时间且不提供重试按钮', async () => {
    server.use(...githubHandlers({ rateLimited: true }));

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    /**
     * 断言用的文案必须与组件里实际渲染的一致。
     *
     * 第一版这里写的是 `/限流|请求次数已用完/`，但组件给的提示是
     * 「GitHub 未认证接口每小时限 60 次，额度将在约 X 后重置」——
     * 文案里没有"限流"二字，于是测试失败。
     *
     * 这次失败是测试的正当价值：它暴露了我的假设与实际文案不符。
     * 修的是断言，而不是为了迁就断言去改产品文案 ——
     * 面向用户的提示语不该为了测试好写而调整。
     */
    expect(await screen.findByText(/未认证接口每小时限 60 次/)).toBeInTheDocument();
    expect(screen.getByText(/额度将在约/)).toBeInTheDocument();
    // 限流时重试会消耗更多额度，所以不给按钮
    expect(screen.queryByRole('button', { name: /重新加载/ })).toBeNull();
  });

  it('结构异常时不提供重试按钮', async () => {
    // 接口变更重试无用，给了按钮只会让用户白等
    server.use(...githubHandlers({ malformed: true }));

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    expect(await screen.findByText(/数据结构/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /重新加载/ })).toBeNull();
  });

  it('网络错误会按退避策略重试，最终给出重试按钮', async () => {
    /**
     * 这个用例必须把超时放宽。
     *
     * QueryClient 的重试策略是"网络类错误指数退避重试 2 次"，
     * 退避间隔为 1s 与 2s —— 从首次请求到进入最终错误态大约 3 秒，
     * 而 Jest/Vitest 的默认超时是 5 秒，`findBy*` 的默认等待更短。
     * 所以这里显式给足时间，否则会得到一个"看起来是功能坏了"的假失败。
     *
     * 后面的重试成功用例会另外验证"重试真的重新发了请求"，
     * 这个用例只关注"最终错误态的 UI 是否正确"。
     */
    let requestCount = 0;
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () => {
        requestCount += 1;
        return HttpResponse.error();
      }),
    );

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    const retryButton = await screen.findByRole(
      'button',
      { name: /重新加载/ },
      { timeout: 10_000 },
    );

    expect(retryButton).toBeInTheDocument();
    // 1 次原始请求 + 2 次重试
    expect(requestCount).toBe(3);
  }, 15_000);

  it('失败后手动重试能恢复', async () => {
    const user = userEvent.setup();
    let attempts = 0;

    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () => {
        attempts += 1;
        // 前 3 次都失败（原始请求 + 2 次自动重试），之后成功。
        // 这样能验证"手动重试"这个用户动作本身有效，而不只是自动重试的功劳。
        return attempts <= 3
          ? HttpResponse.error()
          : HttpResponse.json([mockRepository({ name: 'recovered' })]);
      }),
    );

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    const retryButton = await screen.findByRole(
      'button',
      { name: /重新加载/ },
      { timeout: 10_000 },
    );
    await user.click(retryButton);

    expect(await screen.findByRole('link', { name: 'recovered' })).toBeInTheDocument();
  }, 15_000);

  it('排除 fork 与归档仓库后没有可展示项时给出说明', async () => {
    server.use(
      ...githubHandlers({
        repositories: [
          { name: 'forked', fork: true },
          { name: 'archived', archived: true },
        ],
      }),
    );

    renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    expect(await screen.findByText(/没有可展示的公开仓库/)).toBeInTheDocument();
  });

  it('显示仓库总数与接口额度', async () => {
    server.use(
      ...githubHandlers({
        repositories: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      }),
    );

    renderWithQuery(<GithubRepositories username="someone" limit={2} />);

    // totalCount 是筛选前的总数，limit 只影响展示条数
    expect(await screen.findByText(/共 3 个公开仓库/)).toBeInTheDocument();
    expect(screen.getByText(/展示最近更新的 2 个/)).toBeInTheDocument();
    expect(screen.getByText(/接口额度剩余 59\/60/)).toBeInTheDocument();
  });

  it('在 Query 缓存里写入结果（证明确实走了 Query 而非本地状态）', async () => {
    server.use(...githubHandlers({ repositories: [{ name: 'cached' }] }));

    const { client } = renderWithQuery(<GithubRepositories username="someone" limit={4} />);

    await screen.findByRole('link', { name: 'cached' });

    const cached = client.getQueryCache().findAll({ queryKey: ['github', 'repos', 'someone'] });

    expect(cached).toHaveLength(1);
    expect(cached[0]?.state.status).toBe('success');
  });

  it('重新渲染不会重复发请求（缓存生效）', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${API_BASE}/users/:username/repos`, () => {
        requestCount += 1;
        return HttpResponse.json([mockRepository({ name: 'once' })]);
      }),
    );

    const { rerender, client } = renderWithQuery(
      <GithubRepositories username="someone" limit={4} />,
    );

    await screen.findByRole('link', { name: 'once' });

    rerender(
      <QueryClientProvider client={client}>
        <GithubRepositories username="someone" limit={4} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(requestCount).toBe(1);
    });
  });
});
