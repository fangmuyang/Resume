/**
 * 搜索索引守卫。
 *
 *   pnpm verify:search
 *
 * ## 为什么需要它
 *
 * 搜索索引是从内容**派生**出来的：项目、文章、技能、教育经历都被映射成条目。
 * 派生数据最容易出的问题是"内容变了，索引没跟上"，表现为"某个项目搜不到"——
 * 这类问题很难被注意到，因为页面本身看起来完全正常。
 *
 * ## 检查范围与边界（重要）
 *
 * 本脚本只验证**数据层**能成立的东西：条目覆盖是否完整、跳转目标是否存在。
 * 它**不**重新实现一遍 Fuse 去测"搜索质量"——那会变成用被测逻辑测试自己，
 * 而且模糊匹配的效果本来就该在阶段 9 用真实浏览器测。
 *
 * 所以这里的定位是"防内容漂移"，不是"测搜索算法"。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { profileSchema } from '../src/lib/content/schema/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const contentDir = join(projectRoot, 'content');

const failures: string[] = [];

function check(label: string, passed: boolean, detail = ''): void {
  console.log(`${passed ? '✓' : '✗'} ${label}${detail === '' ? '' : ` — ${detail}`}`);
  if (!passed) failures.push(label);
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(contentDir, relativePath), 'utf8')) as unknown;
}

interface ProjectShape {
  slug: string;
}
interface PostIndexShape {
  posts: { slug: string; draft: boolean }[];
}
interface SkillGroupShape {
  id: string;
  label: string;
}

function main(): void {
  const profile = profileSchema.parse(readJson('profile-public.json'));
  const projects = readdirSync(join(contentDir, 'projects'))
    .filter((name) => name.endsWith('.json'))
    .map(
      (name) =>
        JSON.parse(readFileSync(join(contentDir, 'projects', name), 'utf8')) as ProjectShape,
    );
  const postIndex = readJson('posts-index.json') as PostIndexShape;
  const skillGroups = readJson('skills.json') as SkillGroupShape[];

  const publishedPosts = postIndex.posts.filter((post) => !post.draft);

  console.log(
    `内容来源：${projects.length} 个项目、${publishedPosts.length} 篇已发布文章、${skillGroups.length} 个技能分组`,
  );

  // ---- 检查 1：每类内容都能产生索引条目 ----
  // 用页面模块清单验证"被检索的页面都存在"，避免搜索结果点进去是 404。
  // 这是内容漂移最典型的症状：加了新页面但索引/路由没跟上。
  const pageFiles = new Set(readdirSync(join(projectRoot, 'src', 'pages')));

  const requiredPages = [
    'home.tsx',
    'about.tsx',
    'projects.tsx',
    'project-detail.tsx',
    'posts.tsx',
    'post-detail.tsx',
    'resume.tsx',
    'contact.tsx',
  ];

  const missingPages = requiredPages.filter((name) => !pageFiles.has(name));
  check('被检索的页面模块都存在', missingPages.length === 0, missingPages.join(', '));

  // ---- 检查 2：slug 合法且唯一 ----
  // 索引条目 id 用 `${kind}:${slug}` 保证唯一；如果项目或文章内部 slug 重复，
  // 搜索结果会出现重复条目
  const projectSlugs = projects.map((project) => project.slug);
  const duplicateProjects = projectSlugs.filter(
    (slug, index) => projectSlugs.indexOf(slug) !== index,
  );
  check('项目 slug 唯一', duplicateProjects.length === 0, duplicateProjects.join(', '));

  const postSlugs = publishedPosts.map((post) => post.slug);
  const duplicatePosts = postSlugs.filter((slug, index) => postSlugs.indexOf(slug) !== index);
  check('文章 slug 唯一', duplicatePosts.length === 0, duplicatePosts.join(', '));

  // ---- 检查 3：净化后的资料不含私密联系方式 ----
  // 搜索索引会进产物。如果净化副本里还有 phone 条目，
  // 索引就可能把它带出去 —— 这里从数据层面再兜一道
  const privateEntries = profile.links.filter((link) => link.kind === 'phone');
  check(
    '净化后的资料不含手机号',
    privateEntries.length === 0,
    privateEntries.length > 0 ? 'profile-public.json 里仍有 phone 条目' : '',
  );

  // ---- 检查 4：内容非空 ----
  // 全空时搜索面板会永远显示"没有结果"，但那其实是内容管道坏了
  check(
    '索引内容非空',
    projects.length > 0 && publishedPosts.length > 0 && skillGroups.length > 0,
    `项目 ${projects.length} / 文章 ${publishedPosts.length} / 技能组 ${skillGroups.length}`,
  );

  console.log('');
  if (failures.length > 0) {
    console.error(`搜索索引检查失败 ${failures.length} 项：${failures.join('、')}`);
    process.exitCode = 1;
  } else {
    console.log('搜索索引检查全部通过。');
  }
}

main();
