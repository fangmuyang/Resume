/**
 * 简历页的辅助逻辑。
 *
 * 与组件分开放：组件文件只应导出组件，否则 React Fast Refresh
 * 会退化成整页刷新（ESLint 的 react-refresh/only-export-components 会提醒）。
 */
import { useState } from 'react';

/** PDF 预览的展开状态 */
export function usePdfPreviewToggle(initial = false): {
  isOpen: boolean;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(initial);

  return {
    isOpen,
    toggle: () => setIsOpen((open) => !open),
  };
}

/** 把字节数格式化成可读体积，用于下载按钮旁的提示 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
