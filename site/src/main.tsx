import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { router } from '@/app/router';
import '@/styles/index.css';

const container = document.getElementById('root');

// noUncheckedIndexedAccess 打开后 getElementById 返回 HTMLElement | null，
// 这里显式判空，而不是用 `!` 断言把风险藏起来。
if (!container) {
  throw new Error('找不到 #root 挂载点，请检查 index.html');
}

/**
 * 这里**没有**全局的 QueryClientProvider。
 *
 * TanStack Query 只被「开源仓库」区块用到，所以它的 Provider 放在那个区块的
 * 懒加载边界内（features/github/lazy-github-repositories.tsx）。
 * 挂在这里会让整个 Query 库进入主包，实测主 chunk 从 95 KB 涨到 175 KB。
 */
createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
