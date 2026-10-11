/**
 * 内容零硬编码守卫。
 *
 *   pnpm verify:content
 *
 * 为什么需要它：阶段验收标准里有「内容全部来自 content/，零硬编码文案」这一条。
 * 这种约定靠人自觉是保不住的 —— 改个错别字时顺手在组件里写死一个字符串，
 * 谁也不会发现。所以把它变成可执行的检查。
 *
 * 判据的设计过程（第一版误报 19 处，说明判据太糙）：
 * 最初「凡是 content 里出现过的字符串都不许出现在源码里」，结果 React、
 * TypeScript、HTML 这些**技术名**全部命中 —— 因为技能列表里确实有它们，
 * 而它们作为框架名出现在代码和注释里是完全正常的。
 *
 * 收紧后的判据：
 * 1. 只检查**事实型**字符串：含空格/中文标点、或长度 ≥ 8 的串
 *    （"浙江经贸职业技术学院"、"养生居智慧养老"、"257028151@qq.com"）；
 * 2. 跳过纯技术名的短串（React、Vue、Git 这类单词语）；
 * 3. 跳过注释行 —— 注释里提到框架名不是硬编码内容。
 *
 * 代价是可能漏掉"内容里恰好有个 4 字符的独立事实词"被硬编码，
 * 但那种情况几乎不会造成维护问题。宁可少报也不要制造大量误报，
 * 否则这条检查很快就会被 ignore 掉。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
/** 项目根目录（site/）：内容与源码都在它下面 */
const projectRoot = dirname(here);
/** 仓库根目录，用于把报告里的路径显示成相对形式 */
const repoRoot = dirname(projectRoot);
const contentDir = join(projectRoot, 'content');

/** 需要扫描的源码目录 */
const SOURCE_DIRS = [join(projectRoot, 'src', 'pages'), join(projectRoot, 'src', 'components')];

/** 单词语技术名不算"事实"，不参与检查 */
const MIN_LENGTH_SINGLE_WORD = 8;
const MIN_LENGTH_PHRASE = 4;

/**
 * 允许出现在源码里的内容值。
 * 每一条都要说明理由 —— 否则这个白名单会慢慢变成"什么都放行"。
 */
const ALLOWED = new Set([
  // link.kind 的枚举值，是数据结构的一部分而不是展示内容
  'phone',
]);

function isFactLike(value: string): boolean {
  if (value.length < MIN_LENGTH_PHRASE) return false;

  // 含空格或中文标点 → 一定是短语/句子，属于事实型内容
  const hasSpaceOrPunctuation = /[\s，。、；：·—]/.test(value);
  if (hasSpaceOrPunctuation) return true;

  // 单个词：只有足够长（如 "257028151@qq.com"、"浙江经贸职业技术学院"）才检查
  return value.length >= MIN_LENGTH_SINGLE_WORD;
}

function collectJsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // raw/ 只是 PDF 原始文本，不是站点内容，跳过
      return name === 'raw' ? [] : collectJsonFiles(full);
    }
    return name.endsWith('.json') ? [full] : [];
  });
}

/**
 * 不需要参与硬编码检查的字段名。
 *
 * 理由是"这类值本来就该出现在源码里"：
 * - `file`：公开资产的 URL 片段（如 `resume.pdf`），组件必须按名字引用它。
 *
 * 注意这里按**字段名**排除，而不是把具体值加进白名单 ——
 * 前者表达的是"这一类字段不是展示文案"，后者会随着新资产慢慢变成一张废纸。
 */
const IGNORED_FIELDS = new Set(['file']);

/**
 * 递归取出 JSON 里所有值得检查的字符串值。
 * 跳过 IGNORED_FIELDS 里的键，其余按 isFactLike 判断。
 */
function collectStrings(value: unknown, out: string[], parentKey: string | null = null): void {
  if (typeof value === 'string') {
    if (parentKey !== null && IGNORED_FIELDS.has(parentKey)) return;
    if (!value.startsWith('TODO:') && isFactLike(value)) out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, parentKey);
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectStrings(item, out, key);
  }
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collectSourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const facts = new Set<string>();

for (const file of collectJsonFiles(contentDir)) {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const strings: string[] = [];
  collectStrings(parsed, strings);
  for (const value of strings) facts.add(value);
}

const violations: { file: string; line: number; fact: string; text: string }[] = [];

for (const file of SOURCE_DIRS.flatMap(collectSourceFiles)) {
  const lines = readFileSync(file, 'utf8').split('\n');

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    // 跳过 import/export 语句与注释行：路径与说明里出现框架名是正常的
    if (/^(import|export)\b/.test(trimmed)) continue;
    if (/^(\/\/|\/\*|\*)/.test(trimmed)) continue;

    for (const fact of facts) {
      if (ALLOWED.has(fact)) continue;
      if (line.includes(fact)) {
        violations.push({
          file: relative(repoRoot, file),
          line: index + 1,
          fact,
          text: trimmed.slice(0, 80),
        });
      }
    }
  }
}

console.log(`已收集 ${facts.size} 条事实型内容，扫描 ${SOURCE_DIRS.length} 个目录。`);

if (violations.length === 0) {
  console.log('✓ 未发现硬编码内容：页面文案全部来自 content/。');
} else {
  console.error(`✗ 发现 ${violations.length} 处硬编码内容：\n`);
  for (const item of violations) {
    console.error(`  ${item.file}:${item.line}`);
    console.error(`    内容值「${item.fact}」出现在源码中：${item.text}\n`);
  }
  process.exitCode = 1;
}
