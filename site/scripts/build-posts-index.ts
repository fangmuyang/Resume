/**
 * 生成文章索引。
 *
 *   pnpm build:posts-index
 *
 * 从 content/posts/*.mdx 的 frontmatter 生成 content/posts-index.json，
 * 包含列表页需要的全部元数据（含构建期算好的阅读时长）。
 *
 * ## 为什么必须有这一步
 *
 * 浏览器侧拿不到文章的原始文本（MDX 已编译成组件），而列表页需要元数据。
 * 具体两条死路与结论见 lib/content/schema/post.ts 里 postIndexSchema 的说明。
 *
 * ## 为什么落盘并纳入版本控制
 *
 * 落盘让"内容"可 diff、可 review、可回滚 —— 与 content/ 下其他 JSON 一致。
 * 重跑本脚本会覆盖它，因此它是**产物**而不是手工维护的文件。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { postIndexSchema, POSTS_DIR, validatePost } from '../src/lib/content/validate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const postsDir = join(projectRoot, 'content', POSTS_DIR);
const outputPath = join(projectRoot, 'content', 'posts-index.json');

function readPostFiles(): string[] {
  try {
    return readdirSync(postsDir)
      .filter((name) => name.endsWith('.mdx'))
      .sort();
  } catch {
    // 还没有文章是合法状态，生成一个空索引即可
    return [];
  }
}

function main(): void {
  const fileNames = readPostFiles();

  const posts = fileNames
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '');
      const source = readFileSync(join(postsDir, fileName), 'utf8');
      return validatePost(source, slug, `content/${POSTS_DIR}/${fileName}`);
    })
    // 按日期倒序：最新的文章在前。同一天则按标题稳定排序，避免顺序随机
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-Hans-CN'));

  // 用同一套 schema 校验自己的产出，与 PDF 提取脚本的做法一致
  const index = postIndexSchema.parse({ posts });

  writeFileSync(outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  console.log(`已写入 ${relative(repoRoot, outputPath)}`);
  console.log(`  共 ${posts.length} 篇文章`);
  for (const post of posts) {
    const draftMark = post.draft ? '（草稿）' : '';
    console.log(`  · ${post.date}  ${post.title}${draftMark}  ${post.readingMinutes} 分钟`);
  }
}

main();
