/**
 * 生成"可公开"的内容副本。
 *
 *   pnpm build:public-content
 *
 * ## 为什么必须有这一步（这是一次真实的安全修复）
 *
 * 最初的隐私处理是**条件渲染**：组件里读 `profile.privacy.showPhone`，
 * 为 false 就不渲染手机号。看起来没问题，但实测被 `pnpm verify:privacy` 拦下了：
 *
 * ```
 * ✗ 发现 1 处隐私泄漏：
 *   site\dist\assets\index-*.js  包含受隐私开关保护的 phone（11 位号码）
 * ```
 *
 * 原因是 `content/profile.json` 整个文件会被 `import.meta.glob` 内联进产物 ——
 * **数据在 bundle 里，渲染与否无关紧要**。任何人打开 DevTools 搜索一下就能看到。
 *
 * 条件渲染只能决定"显示什么"，不能决定"传输什么"。
 * 所以这里改成在构建期按公开边界生成净化副本：不公开的字段**不在产物里存在**，
 * 组件也就不需要再判断隐私开关（少一个可能写错的分支）。
 *
 * ## 处理策略
 *
 * - `links` 里 `public: false` 的条目直接删除；
 * - `privacy` 字段本身保留（页面用它决定是否显示"出于隐私考虑未展示手机号"的说明）；
 * - 其余字段原样保留。
 *
 * 这个脚本的产出 `profile-public.json` 是**产物**，纳入版本控制以便 diff，
 * 但不要手工编辑 —— 改源头 `profile.json` 然后重跑。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { profileSchema } from '../src/lib/content/schema/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const contentDir = join(projectRoot, 'content');

const SOURCE = join(contentDir, 'profile.json');
const OUTPUT = join(contentDir, 'profile-public.json');

function main(): void {
  const raw: unknown = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const profile = profileSchema.parse(raw);

  const publicLinks = profile.links.filter((link) => link.public);

  const removed = profile.links.length - publicLinks.length;

  const publicProfile = { ...profile, links: publicLinks };

  writeFileSync(OUTPUT, `${JSON.stringify(publicProfile, null, 2)}\n`, 'utf8');

  console.log(`已写入 ${relative(repoRoot, OUTPUT)}`);
  console.log(`  联系方式：保留 ${publicLinks.length} 条，移除 ${removed} 条非公开条目`);

  if (removed === 0) {
    console.log('  提示：目前没有非公开条目，本次输出与源文件等价。');
  }
}

main();
