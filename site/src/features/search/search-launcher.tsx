import { lazy, Suspense, useEffect } from 'react';

import { isSearchShortcut, useSearchStore } from '@/features/search/search-store';

/**
 * 搜索面板的懒加载容器。
 *
 * ## 为什么懒加载
 *
 * 面板本身不大，但它会带上 Fuse.js 和整个搜索索引。
 * 这些内容对首屏渲染毫无帮助 —— 用户可能整个会话都不搜一次。
 * 拆出去之后主包不再包含它们，只有真正按快捷键时才下载。
 *
 * ## 为什么快捷键监听放在这里
 *
 * 快捷键是"打开搜索"的入口之一，和面板的生命周期天然相关。
 * 挂在根布局里（这个组件被根布局引用）意味着任何页面按 ⌘K 都能唤起。
 */
const SearchDialog = lazy(async () => {
  const module = await import('@/features/search/search-dialog');
  return { default: module.SearchDialog };
});

export function SearchLauncher() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const open = useSearchStore((state) => state.open);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isSearchShortcut(event)) {
        // 阻止浏览器默认行为：Chrome 里 Ctrl+K 会聚焦地址栏
        event.preventDefault();
        open();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // 面板未打开时不渲染任何东西，也就不触发懒加载
  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <SearchDialog />
    </Suspense>
  );
}
