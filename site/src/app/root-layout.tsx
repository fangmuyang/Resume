import { useEffect } from 'react';

import { PageTransition } from '@/app/page-transition';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { SearchLauncher } from '@/features/search/search-launcher';
import { subscribeToSystemTheme } from '@/features/theme/theme-store';

/**
 * 站点外壳：所有页面共用的 Header / Footer。
 *
 * 子路由通过 PageTransition 里的 Outlet 渲染，而不是把页面当 children 传进来 ——
 * 这是 React Router 布局路由的标准写法：Header 不会因为导航而重新挂载，
 * 移动端抽屉的开关状态也就不会被重置。
 */
export default function RootLayout() {
  // 用户选择"跟随系统"时，需要在系统主题变化时同步切换
  useEffect(() => subscribeToSystemTheme(), []);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <Header />

      <main className="flex-1">
        <PageTransition />
      </main>

      <Footer />

      {/* 搜索面板：懒加载，未唤起时不下载任何代码 */}
      <SearchLauncher />
    </div>
  );
}
