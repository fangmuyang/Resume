/**
 * 内容占位标记的判定。
 *
 * 放在 lib/ 而不是组件文件里：组件文件只应导出组件，
 * 否则 React Fast Refresh 会退化成整页刷新
 * （ESLint 的 react-refresh/only-export-components 就是在提醒这件事）。
 */

/** 内容管道用这个前缀标记待补字段，见 scripts/extract-pdf.ts */
export const TODO_PREFIX = 'TODO:';

export function isPlaceholder(text: string): boolean {
  return text.startsWith(TODO_PREFIX);
}

/** 去掉 TODO: 前缀，用于展示可读的提示文案 */
export function stripPlaceholderPrefix(text: string): string {
  return isPlaceholder(text) ? text.slice(TODO_PREFIX.length) : text;
}
