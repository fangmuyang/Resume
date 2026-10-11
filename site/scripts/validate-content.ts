/**
 * 内容校验 CLI。
 *
 *   pnpm validate
 *
 * 存在的意义：`vite build` 里的 content-guard 插件已经会在构建期校验内容，
 * 但那个反馈要等整个构建跑起来才拿到。这个脚本让"只检查内容"变成一条秒级命令，
 * 适合放进 lint-staged，也适合在改完 JSON 后立刻跑一次。
 *
 * 另外它会统计内容里剩下多少 "TODO:" 占位，提醒哪些信息还没补全。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTENT_FILES, PROJECTS_DIR, validateAllContent } from '../src/lib/content/validate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const contentRoot = join(repoRoot, 'content');

function readJson(relativePath: string): unknown {
  const raw = readFileSync(join(contentRoot, relativePath), 'utf8');

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`content/${relativePath} 不是合法的 JSON：${(error as Error).message}`);
  }
}

function countTodos(value: unknown): number {
  if (typeof value === 'string') {
    return value.includes('TODO:') ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countTodos(item), 0);
  }

  if (value !== null && typeof value === 'object') {
    return Object.values(value).reduce<number>((sum, item) => sum + countTodos(item), 0);
  }

  return 0;
}

function main(): void {
  const projectsDir = join(contentRoot, PROJECTS_DIR);

  const projectPaths = readdirSync(projectsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => `${PROJECTS_DIR}/${name}`)
    .sort();

  const entryPaths = Object.values(CONTENT_FILES);
  const allPaths = [...entryPaths, ...projectPaths];

  let content: ReturnType<typeof validateAllContent>;

  try {
    content = validateAllContent(readJson, projectPaths);
  } catch (error) {
    console.error(`✗ ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  console.log('✓ 内容校验通过');
  console.log(`  入口文件 ${entryPaths.length} 个：${entryPaths.join(', ')}`);
  console.log(`  作品集文件 ${projectPaths.length} 个`);
  console.log(`  精选项目 ${content.projects.filter((project) => project.featured).length} 个`);
  console.log(`  技能分组 ${content.skillGroups.length} 组`);

  const todoCount = allPaths.reduce((sum, path) => sum + countTodos(readJson(path)), 0);

  if (todoCount > 0) {
    console.log(`\n⚠ 还剩 ${todoCount} 处 "TODO:" 占位内容需要替换为真实信息。`);
    console.log('  提示：这是正常的中间状态，但上线前应当清空。');
  } else {
    console.log('\n内容已无 TODO 占位，可以发布。');
  }
}

main();
