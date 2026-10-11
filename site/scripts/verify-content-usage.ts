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

/**
 * 需要扫描的源码目录。
 *
 * ## 为什么扩大到整个 src/
 *
 * 第一版只扫 `src/pages` 与 `src/components` —— 因为当时文案只写在那两处。
 * 但这是个**范围缺口**：把文案写进 `src/lib/` 或 `src/features/` 就能绕过检查。
 * 阶段 10 加 SEO 组件时我自己就撞上了这个缺口（`src/lib/seo/` 里的文案没被检查）。
 *
 * 一个"只覆盖部分目录"的守卫比没有守卫更危险：它会让人误以为已经被保护了。
 * 所以范围扩到整个 `src/`，只排除真正不该检查的部分（见下方 EXCLUDED）。
 */
const SOURCE_ROOT = join(projectRoot, 'src');

/**
 * 不参与硬编码检查的路径片段。
 *
 * 每一类都有明确理由，不是"检查报错就加进来"：
 * - `test/`：测试里的期望值本来就该是字面量，断言依赖具体文案；
 * - `.test.`：同上；
 * - `content/`：构建期专用的 schema 与校验代码，它们的字符串是**字段名与默认值**，
 *   不是展示文案（且不进入浏览器产物）。
 */
const EXCLUDED_PATH_PARTS = ['/test/', '.test.', '/lib/content/'];

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

/**
 * 不参与检查的内容文件。
 *
 * `enum-labels.json` 是**枚举标签表**：它的键（`completed`、`job`）是数据模型里的
 * 标识符，不是展示文案 —— 组件必须以字面量引用它们才能完成类型检查
 * （`Record<Project['status'], string>` 的键就是这些标识符）。
 *
 * 如果把这些键也当作"内容值"，就会陷入一个死循环：
 * 无论怎么组织代码，都必须在某处写出 `completed` 这个字符串。
 * 加入白名单是承认这个事实，而不是为了让检查通过而放水 ——
 * 该文件的**值**（`已完成`、`实习 / 工作机会`）仍然照常检查。
 */
const EXCLUDED_CONTENT_FILES = new Set(['enum-labels.json']);

function collectJsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // raw/ 只是 PDF 原始文本，不是站点内容，跳过
      return name === 'raw' ? [] : collectJsonFiles(full);
    }
    if (!name.endsWith('.json')) return [];
    if (EXCLUDED_CONTENT_FILES.has(name)) return [];
    return [full];
  });
}

/**
 * 不需要参与硬编码检查的字段名。
 *
 * 理由是"这类值本来就该出现在源码里"：
 * - `file`：公开资产的 URL 片段（如 `resume.pdf`），组件必须按名字引用它。
 * - `status`：枚举标识符（`active` / `completed` / `archived`）。
 *   组件需要用它们做类型化的查表（`STATUS_CLASS[project.status]`），
 *   所以字符串必然出现在源码里。**它们的展示文案在 enum-labels.json 里**，
 *   那份文件的“值”照常受检查 —— 所以硬编码风险并没有被放过。
 *
 * 注意这里按**字段名**排除，而不是把具体值加进白名单 ——
 * 前者表达的是"这一类字段不是展示文案"，后者会随着新内容慢慢变成一张废纸。
 */
const IGNORED_FIELDS = new Set(['file', 'status']);

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

    if (!/\.tsx?$/.test(name)) return [];

    // 路径片段匹配（统一用正斜杠，避免 Windows 反斜杠导致匹配失败）
    const normalized = full.replace(/\\/g, '/');
    if (EXCLUDED_PATH_PARTS.some((part) => normalized.includes(part))) return [];

    return [full];
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

const sourceFiles = collectSourceFiles(SOURCE_ROOT);

for (const file of sourceFiles) {
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

console.log(`已收集 ${facts.size} 条事实型内容，扫描 ${sourceFiles.length} 个源码文件。`);

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
