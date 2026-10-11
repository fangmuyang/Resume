/**
 * 隐私守卫：确认受隐私开关保护的字段没有泄漏到产物里。
 *
 *   pnpm verify:privacy
 *
 * ## 为什么需要它在**构建之后**运行
 *
 * `profile.privacy.showPhone` 是一个内容开关，组件里按它决定是否渲染手机号。
 * 但"组件里写了 if 判断"和"产物里真的没有这个号码"是两件事 ——
 * 中间可能有很多意外：某个 meta 标签、某个 JSON-LD、console.log 调试残留、
 * 或者某个组件忘了走开关，都会把号码带到线上。
 *
 * 所以这里做的是**端到端验证**：扫描构建产物（HTML + JS + CSS），
 * 直接找受保护的值。这比读代码检查可靠得多。
 *
 * ## 判据的来源
 *
 * 受保护的字段从 content/profile.json 里读取，而不是在脚本里再写一遍。
 * 因此 `privacy` 里声明哪个 link 不公开，本脚本就检查哪个 —— 单一来源。
 *
 * 注意：脚本自身源码里不会出现完整的号码。匹配用的是内容里读到的值，
 * 而脚本只保存它的"数字前缀 + 长度"，避免守卫脚本自己变成泄漏点。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const contentDir = join(projectRoot, 'content');
const distDir = join(projectRoot, 'dist');

interface ProfileShape {
  privacy?: { showPhone?: boolean };
  links?: { kind?: string; value?: string; public?: boolean }[];
}

function readProfile(): ProfileShape {
  return JSON.parse(readFileSync(join(contentDir, 'profile.json'), 'utf8')) as ProfileShape;
}

/** 递归收集目录下所有文件 */
function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? collectFiles(full) : [full];
  });
}

/**
 * 从受保护的链接里提取**用于搜索的敏感片段**。
 *
 * 对 tel: 链接取号码的数字部分；只保留长度信息用于报告，
 * 不把完整号码写进任何输出。
 */
function sensitiveFragments(profile: ProfileShape): { label: string; needle: string }[] {
  const fragments: { label: string; needle: string }[] = [];

  for (const link of profile.links ?? []) {
    const isPrivate =
      link.public === false || (link.kind === 'phone' && !profile.privacy?.showPhone);
    if (!isPrivate) continue;

    const value = link.value ?? '';
    const digits = value.replace(/\D/g, '');

    if (digits.length >= 7) {
      fragments.push({
        label: `${link.kind ?? 'link'}（${digits.length} 位号码）`,
        needle: digits,
      });
    }
  }

  return fragments;
}

function main(): void {
  if (!existsSync(distDir)) {
    console.error('找不到 dist/ 目录，请先运行 pnpm build。');
    process.exitCode = 1;
    return;
  }

  const profile = readProfile();
  const fragments = sensitiveFragments(profile);

  if (fragments.length === 0) {
    console.log('没有需要检查的私密字段（profile.privacy 下没有非公开的联系方式）。');
    return;
  }

  const files = collectFiles(distDir);
  const leaks: { file: string; label: string }[] = [];

  for (const file of files) {
    // 只看文本类产物；PDF 是二进制，它的内容由下载策略控制而不是这里扫描
    if (!/\.(js|css|html|json|webmanifest|svg)$/.test(file)) continue;

    const text = readFileSync(file, 'utf8');

    for (const fragment of fragments) {
      if (text.includes(fragment.needle)) {
        leaks.push({ file: relative(repoRoot, file), label: fragment.label });
      }
    }
  }

  console.log(`已扫描 ${files.length} 个产物文件，检查 ${fragments.length} 个私密字段。`);

  if (leaks.length === 0) {
    console.log('✓ 未发现私密字段泄漏到产物中。');
    return;
  }

  console.error(`\n✗ 发现 ${leaks.length} 处隐私泄漏：\n`);
  for (const leak of leaks) {
    console.error(`  ${leak.file}`);
    console.error(`    包含受隐私开关保护的 ${leak.label}\n`);
  }
  console.error('请检查：是否有组件绕过了 profile.privacy 开关，或存在调试残留。');
  process.exitCode = 1;
}

main();
