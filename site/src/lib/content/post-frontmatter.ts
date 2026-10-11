/**
 * MDX frontmatter 解析。
 *
 * ## 为什么自己写，而不是用 gray-matter
 *
 * gray-matter 能用，但它支持完整 YAML —— 对 frontmatter 这个场景是过量的，
 * 而且会引入额外依赖。这里只需要支持 frontmatter 实际用到的子集：
 *
 * ```yaml
 * title: 标题
 * date: 2025-01-01
 * updated: null
 * draft: false
 * tags:
 *   - React
 *   - 类型系统
 * ```
 *
 * 也就是说：`key: 标量` 与 `key:` 后面跟 `- 项` 的列表。
 * 不支持嵌套对象、锚点、多行字符串等 —— 一旦需要，就应该换成真正的 YAML 解析器。
 *
 * ## 为什么不直接用 MDX 导出的 frontmatter
 *
 * `@mdx-js/rollup` 会把 frontmatter 作为模块导出，运行时就能拿到。
 * 但那样就得**在浏览器里**用 Zod 校验它，Zod 会被打进产物 ——
 * 与阶段 1 定下的「校验只在构建期」取舍矛盾。
 * 所以这里在构建期解析并校验，运行时只用校验过的结果。
 */

/** 去除值两端的引号，并识别 null / true / false */
function parseScalar(raw: string): unknown {
  const value = raw.trim();

  if (value === '') return null;
  if (value === 'null' || value === '~') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;

  // 去掉成对引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  /** 正文（已去掉 frontmatter 区块） */
  content: string;
}

/**
 * 解析 MDX 文件内容，分离 frontmatter 与正文。
 *
 * 输入不是合法 frontmatter 时不会抛错，只返回空的 data ——
 * 因为「必填字段缺失」这件事应该由 Zod 报出来（带字段名更能定位问题），
 * 而不是在这里抛一个笼统的解析错误。
 */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  // 必须从文件最开头开始，且以单独一行的 --- 结束
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);

  if (match === null) {
    return { data: {}, content: source };
  }

  const block = match[1] ?? '';
  const content = source.slice(match[0].length);
  const data: Record<string, unknown> = {};

  let currentListKey: string | null = null;

  for (const rawLine of block.split(/\r?\n/)) {
    // 列表项：`  - 值`
    const listItem = /^\s*-\s+(.*)$/.exec(rawLine);
    if (listItem !== null) {
      const value = parseScalar(listItem[1] ?? '');
      if (currentListKey !== null) {
        const existing: unknown = data[currentListKey];
        // 显式收窄成 unknown[]，而不是直接 spread unknown ——
        // 直接展开会让元素类型变成 any，触发 no-unsafe-assignment
        data[currentListKey] = Array.isArray(existing)
          ? [...(existing as unknown[]), value]
          : [value];
      }
      continue;
    }

    // 键值对：`key: value` 或 `key:`（列表开头）
    const pair = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(rawLine);
    if (pair === null) continue;

    const key = pair[1] ?? '';
    const rest = pair[2] ?? '';

    if (rest.trim() === '') {
      // 后面可能跟列表
      data[key] = [];
      currentListKey = key;
    } else {
      data[key] = parseScalar(rest);
      currentListKey = null;
    }
  }

  return { data, content };
}
