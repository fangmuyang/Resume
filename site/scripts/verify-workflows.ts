/**
 * GitHub Actions 工作流语法守卫。
 *
 *   pnpm verify:workflows
 *
 * ## 为什么需要它（一次真实的静默失效）
 *
 * 阶段 11 我把两个工作流文件都写成了以 `/**` 开头的形式 —— 那是
 * **TypeScript 的块注释语法，YAML 完全不认**（YAML 的注释只有 `#`）。
 *
 * 后果非常有迷惑性：
 * - 文件确实被提交、也确实在远端仓库里（`GET /contents/...` 返回 200）；
 * - `git push` 成功，没有报错；
 * - 但 GitHub **一个工作流都没注册**（`total_count: 0`），
 *   Actions 页面永远空白，看起来像"还没触发"。
 *
 * 也就是说：**语法错误的 YAML 不会让推送失败，只会让 CI 静默地不存在。**
 * 这类"配置写了但没生效"的问题必须靠检查发现，不能靠肉眼看。
 *
 * ## 检查什么
 *
 * 1. 能被 YAML 解析器读懂（这一条就能抓住上面那个错误）；
 * 2. 有 `name` / `on` / `jobs` 三个顶层键；
 * 3. 每个 job 有 `runs-on`，且有 `steps` 或 `uses`。
 *
 * 不做的事：不检查 action 的版本是否存在、不检查权限是否够用 ——
 * 那些只有真正跑起来才知道，检查多了会变成误报来源。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const workflowsDir = join(repoRoot, '.github', 'workflows');

interface JobShape {
  'runs-on'?: unknown;
  steps?: unknown;
  uses?: unknown;
}

interface WorkflowShape {
  name?: unknown;
  jobs?: Record<string, JobShape>;
}

const failures: string[] = [];
const notes: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

/**
 * `on` 在 YAML 1.1 里会被解析成布尔 `true`（这是著名的 YAML 陷阱）。
 * js-yaml v4 默认用 YAML 1.2 核心类型，`on` 保持字符串；
 * 但为了不依赖解析器的具体版本行为，两种键都认。
 */
function hasTriggerKey(document: Record<string, unknown>): boolean {
  return 'on' in document || 'true' in document;
}

function checkWorkflow(filePath: string): void {
  const displayPath = relative(repoRoot, filePath);
  let document: unknown;

  try {
    document = yaml.load(readFileSync(filePath, 'utf8'));
  } catch (error) {
    // 这一条就是当初能抓住 `/**` 注释的错误
    const reason = (error as Error).message.split('\n')[0] ?? '未知解析错误';
    fail(`${displayPath} 不是合法的 YAML：${reason}`);
    return;
  }

  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    fail(`${displayPath} 解析结果不是对象（YAML 文件不能为空）`);
    return;
  }

  const workflow = document as WorkflowShape & Record<string, unknown>;

  if (typeof workflow.name !== 'string' || workflow.name.trim() === '') {
    fail(`${displayPath} 缺少顶层 name（Actions 侧栏会显示成文件路径）`);
  }

  if (!hasTriggerKey(workflow)) {
    fail(`${displayPath} 缺少 on 触发器，推送后不会运行`);
  }

  const jobs = workflow.jobs;

  if (jobs === undefined || typeof jobs !== 'object' || Object.keys(jobs).length === 0) {
    fail(`${displayPath} 缺少 jobs（或为空），没有任何任务可执行`);
    return;
  }

  for (const [jobId, job] of Object.entries(jobs)) {
    if (job === null || typeof job !== 'object') {
      fail(`${displayPath} 的 job "${jobId}" 不是对象`);
      continue;
    }

    if (job['runs-on'] === undefined) {
      fail(`${displayPath} 的 job "${jobId}" 缺少 runs-on`);
    }

    // 一个 job 要么复用别人的 workflow（uses），要么自己写 steps
    if (job.steps === undefined && job.uses === undefined) {
      fail(`${displayPath} 的 job "${jobId}" 既没有 steps 也没有 uses`);
    }
  }

  notes.push(
    `${displayPath} — ${String(workflow.name)}，${String(Object.keys(jobs).length)} 个 job`,
  );
}

function main(): void {
  if (!existsSync(workflowsDir)) {
    console.log('没有 .github/workflows 目录，跳过工作流检查。');
    return;
  }

  const files = readdirSync(workflowsDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(workflowsDir, name))
    .sort();

  if (files.length === 0) {
    fail('.github/workflows 下没有任何 .yml / .yaml 文件');
  }

  for (const file of files) {
    checkWorkflow(file);
  }

  console.log(`GitHub Actions 工作流检查（${String(files.length)} 个文件）\n`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    console.error(`\n工作流检查失败 ${String(failures.length)} 项。`);
    process.exit(1);
  }

  for (const note of notes) {
    console.log(`  ✓ ${note}`);
  }
  console.log('\n工作流检查全部通过。');
}

main();
