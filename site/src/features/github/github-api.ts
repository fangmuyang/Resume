/**
 * GitHub REST API 客户端。
 *
 * ## 为什么这里**不用** Zod
 *
 * 项目的约定是"Zod 只在构建期使用，不进入浏览器产物"（它是 devDependency）。
 * 唯一的例外是联系表单 —— 静态站没有后端，客户端校验是必须的。
 *
 * 但这个 GitHub 客户端不需要 Zod：
 * - 响应结构是**静态且简单**的（几个字段，没有嵌套联合、没有判别式）；
 * - 校验的目的是"取到需要的字段，结构不符时给出可操作的提示"，
 *   一个手写类型守卫就能做到；
 * - 用 Zod 会让整个库进入产物。实测它被打成 85 KB 的独立 chunk
 *   （gzip 24.5 KB）—— 对"少写十几行"来说是明显的得不偿失。
 *
 * 判断依据不是"Zod 好不好"，而是**这笔依赖换来了什么**。
 * 内容管道里的 schema 复杂得多（默认值、refine、跨字段约束、类型推导），
 * 那里用 Zod 是值得的。
 *
 * ## 为什么需要错误分类，而不是"出错就显示失败"
 *
 * GitHub API 的失败模式差异很大，用户能做的应对也完全不同：
 *
 * | 失败 | 原因 | 用户能做什么 |
 * | --- | --- | --- |
 * | 404 | 用户名写错 | 检查配置 |
 * | 403 / 429 且限流归零 | 未认证请求每小时只有 60 次 | 等一会儿 |
 * | 网络错误 | 离线 / 被拦截 | 检查网络 |
 * | 响应结构变了 | API 变更 | 报告问题（重试无用） |
 *
 * 所以这里用**判别联合**表达错误，让界面能给出针对性的提示。
 * "加载失败，请重试" 是最没用的错误信息 —— 用户不知道该做什么。
 *
 * ## 限流这件事值得单独说
 *
 * 未认证的 GitHub API 是 **60 次/小时**，按 IP 计。
 * 把网站分享给朋友之后，一天内用完额度是很现实的 ——
 * 而且同一个 Wi-Fi 下的人共用出口 IP，会互相影响。
 * 这是"静态站点直连第三方 API"的固有限制，必须先承认它，
 * 再决定怎么降级：本项目选择"明确告知 + 允许重试"，
 * 而不是静默显示空列表（那会让人以为是 bug）。
 */

/** 只声明真正会展示的字段 */
export interface GithubRepository {
  readonly id: number;
  readonly name: string;
  readonly html_url: string;
  readonly description: string | null;
  readonly language: string | null;
  readonly stargazers_count: number;
  readonly topics: readonly string[];
  readonly fork: boolean;
  readonly archived: boolean;
  readonly pushed_at: string;
}

/** 错误分类：界面按 kind 给出不同提示 */
export type GithubErrorKind = 'not-found' | 'rate-limited' | 'network' | 'invalid-response';

export class GithubApiError extends Error {
  readonly kind: GithubErrorKind;
  /** 限流时的重置时间，仅 rate-limited 时有值 */
  readonly resetAt: Date | null;

  constructor(kind: GithubErrorKind, message: string, resetAt: Date | null = null) {
    super(message);
    this.name = 'GithubApiError';
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

const API_BASE = 'https://api.github.com';

/** 一次请求的结果：数据 + 剩余额度。额度信息用于在界面提示用户 */
export interface GithubReposResult {
  repositories: GithubRepository[];
  /** 剩余请求次数，取不到时为 null */
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
}

// ---------------- 响应解析（手写类型守卫） ----------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * 把一条 API 原始记录解析成 GithubRepository。
 *
 * 策略：**必需字段缺失就判定整条无效，可选字段缺失则给默认值**。
 * 这样 API 新增/删除可选字段不会让整个列表加载失败（那是过度严格），
 * 而核心字段缺失也不会被静默成 undefined（那会在界面上显示成空白）。
 */
function parseRepository(value: unknown): GithubRepository | null {
  if (!isRecord(value)) return null;

  const id = readNumber(value['id']);
  const name = readString(value['name']);
  const htmlUrl = readString(value['html_url']);

  // 这三个字段缺任何一个，条目都无法正常展示
  if (id === null || name === null || htmlUrl === null) return null;

  return {
    id,
    name,
    html_url: htmlUrl,
    description: readString(value['description']),
    language: readString(value['language']),
    stargazers_count: readNumber(value['stargazers_count']) ?? 0,
    topics: Array.isArray(value['topics'])
      ? value['topics'].filter((topic): topic is string => typeof topic === 'string')
      : [],
    fork: value['fork'] === true,
    archived: value['archived'] === true,
    pushed_at: readString(value['pushed_at']) ?? '',
  };
}

function readToken(): string | null {
  // 环境变量是可选的；公开部署时不注入，因此这里通常返回 null
  const token = import.meta.env.VITE_GITHUB_TOKEN;
  return token === undefined || token === '' ? null : token;
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    // GitHub 要求带 User-Agent，否则返回 403
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const token = readToken();
  if (token !== null) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

/** 从响应头读取限流信息 */
function readRateLimit(
  response: Response,
): Pick<GithubReposResult, 'rateLimitRemaining' | 'rateLimitLimit'> {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const limit = response.headers.get('x-ratelimit-limit');

  return {
    rateLimitRemaining: remaining === null ? null : Number(remaining),
    rateLimitLimit: limit === null ? null : Number(limit),
  };
}

/**
 * 拉取某个用户的公开仓库。
 *
 * 返回全部仓库，由调用方决定展示几条 —— 因为"展示几条"是展示策略，
 * 不该由网络层决定（否则改展示数量就要多发一次请求）。
 */
export async function fetchGithubRepositories(
  username: string,
  signal?: AbortSignal,
): Promise<GithubReposResult> {
  const url = `${API_BASE}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`;

  let response: Response;
  try {
    /**
     * signal 显式转成 `AbortSignal | null`。
     *
     * fetch 的 `RequestInit.signal` 类型是 `AbortSignal | null`，不含 undefined。
     * 开启 exactOptionalPropertyTypes 后，把 `AbortSignal | undefined` 直接传进去
     * 会被拒绝 ——"可以缺失"和"可以是 undefined"在类型上是两件事。
     *
     * signal 让 TanStack Query 在组件卸载或取消时能真正中断请求，
     * 而不是让它在后台跑完再被丢弃。
     */
    response = await fetch(url, { headers: buildHeaders(), signal: signal ?? null });
  } catch (error) {
    // AbortError 是正常取消，不该被当成网络故障
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new GithubApiError('network', '网络请求失败，请检查网络连接');
  }

  const rateLimit = readRateLimit(response);

  if (response.status === 404) {
    throw new GithubApiError('not-found', `找不到 GitHub 用户「${username}」`);
  }

  if (response.status === 403 || response.status === 429) {
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader === null ? null : new Date(Number(resetHeader) * 1000);

    // 403 也可能是权限问题，用剩余额度是否为 0 区分
    if (rateLimit.rateLimitRemaining === 0 || response.status === 429) {
      throw new GithubApiError('rate-limited', 'GitHub 接口请求次数已用完', resetAt);
    }

    throw new GithubApiError('network', 'GitHub 拒绝了这次请求（可能是权限问题）');
  }

  if (!response.ok) {
    throw new GithubApiError('network', `GitHub 返回了意外的状态码 ${response.status}`);
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    throw new GithubApiError(
      'invalid-response',
      'GitHub 返回的数据结构与预期不符，可能是接口有变更',
    );
  }

  const repositories = payload
    .map((item) => parseRepository(item))
    .filter((item): item is GithubRepository => item !== null);

  // 非空响应里一条都解析不出来，说明结构真的变了（而不是个别字段缺失）
  if (repositories.length === 0 && payload.length > 0) {
    throw new GithubApiError(
      'invalid-response',
      'GitHub 返回的仓库数据结构与预期不符，可能是接口有变更',
    );
  }

  return { repositories, ...rateLimit };
}

/**
 * 筛选出适合展示的仓库。
 *
 * 抽成纯函数便于测试（阶段 9 会覆盖），也避免把展示规则散在组件里。
 * 规则：排除 fork 与归档仓库，按 star 数降序、其次按最近提交时间。
 */
export function selectDisplayRepositories(
  repositories: readonly GithubRepository[],
  limit: number,
): GithubRepository[] {
  return repositories
    .filter((repo) => !repo.fork && !repo.archived)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return b.pushed_at.localeCompare(a.pushed_at);
    })
    .slice(0, limit);
}
