import { Link } from 'react-router';

import { profile } from '@/lib/content';
import { NAV_ITEMS } from '@/lib/navigation';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 py-8 dark:border-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © {year} {profile.name} · 用 React 19 + TypeScript 构建
        </p>

        <nav aria-label="页脚导航">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {NAV_ITEMS.filter((item) => item.to !== '/').map((item) => (
              <li key={item.to}>
                {/* 用 Link 而不是 <a>：<a> 会触发整页刷新，把 SPA 的优势全部丢掉 */}
                <Link
                  to={item.to}
                  className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
