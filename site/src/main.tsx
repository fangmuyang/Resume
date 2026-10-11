import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import '@/styles/index.css';

const container = document.getElementById('root');

// noUncheckedIndexedAccess 打开后 getElementById 返回 HTMLElement | null，
// 这里显式判空，而不是用 `!` 断言把风险藏起来。
if (!container) {
  throw new Error('找不到 #root 挂载点，请检查 index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
