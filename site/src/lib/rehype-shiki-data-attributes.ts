/**
 * 把 rehype-pretty-code 产生的内联 style 全部清理掉，颜色改走 data 属性。
 *
 * ## 为什么必须做这件事
 *
 * **MDX 不能编译任何内联 style 属性。** @mdx-js/rollup 用 `hast-util-to-estree`
 * 转换属性，遇到 style 会尝试把它解析成对象，而以下内容都会让它失败：
 *
 * - CSS 自定义属性：`style="--shiki-light:#005cc5;--shiki-dark:#79b8ff"`
 *   （不支持 `--` 开头的属性名）
 * - 常见的 CSS 值：`style="display: grid;"`
 *   （解析器期望的是 JS 对象字面量语法，不是 CSS 声明）
 *
 * 实测两种都会让构建直接中断：
 *
 * ```
 * [@mdx-js/rollup] Could not parse `style` attribute on `span`
 * [@mdx-js/rollup] Could not parse `style` attribute on `code`
 * ```
 *
 * ## 处理策略
 *
 * - `--shiki-light` / `--shiki-dark` → 搬到 `data-light-color` / `data-dark-color`，
 *   颜色由 CSS 按属性选择器决定（见 styles/index.css），仍能跟随 .dark 切换；
 * - 其他内联样式（如 `display: grid`）→ **直接删除**，等价样式在 CSS 里补上。
 *
 * ## 为什么不用 rehype-pretty-code 自带的钩子
 *
 * 它提供 `onVisitLine` / `onVisitHighlightedLine` / `onVisitHighlightedChars`，
 * 但只覆盖「行」与「被高亮的片段」。真正带 style 的是**每个 token 的 span**
 * 以及外层 code 元素，钩子覆盖不到，所以写一个独立的 rehype 插件递归处理。
 */

interface HastElement {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastElement[];
}

export function rehypeShikiVariablesToDataAttributes() {
  return (tree: HastElement): void => {
    walk(tree);
  };
}

function walk(node: HastElement): void {
  if (node.type === 'element') {
    hoistStyle(node);
  }

  for (const child of node.children ?? []) {
    walk(child);
  }
}

function hoistStyle(node: HastElement): void {
  const properties = node.properties;
  const style = properties?.['style'];

  if (properties === undefined || typeof style !== 'string') return;

  const light = /--shiki-light:\s*([^;\s]+)/.exec(style)?.[1];
  const dark = /--shiki-dark:\s*([^;\s]+)/.exec(style)?.[1];

  if (light !== undefined) properties['dataLightColor'] = light;
  if (dark !== undefined) properties['dataDarkColor'] = dark;

  // 无论是否含颜色变量，style 都必须删掉 —— MDX 解析不了它。
  // 被删掉的表现性样式（如 code 的 display: grid）在 CSS 里补。
  delete properties['style'];
}
