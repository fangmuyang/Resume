import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';

import { ThemeToggle } from '@/features/theme/theme-toggle';
import { NAV_ITEMS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * 移动端抽屉。
 *
 * 这里的写法值得单独说明 —— 它替代了一个常见的反模式。
 *
 * 直觉写法是把开关状态放在 Header 里，再用 effect 监听 pathname 变化来收起抽屉：
 *   useEffect(() => { setMenuOpen(false) }, [pathname])
 * 但「在 effect 里同步 setState」会触发一次额外的级联渲染，React 官方明确不推荐
 * （https://react.dev/learn/you-might-not-need-an-effect）。
 *
 * 更符合 React 心智的做法是**用 key 重置状态**：
 * 父组件把 pathname 作为 key 传给本组件，路由一变组件就重新挂载，
 * useState 自然回到初始值 false —— 不需要任何 effect，也没有额外渲染。
 * 这个模式叫 "resetting state with a key"，比在 effect 里手动同步更可靠。
 */
export function MobileNav({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? '关闭菜单' : '打开菜单'}
        aria-expanded={isOpen}
        aria-controls="mobile-nav"
        className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
      >
        {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {isOpen ? (
        <nav
          id="mobile-nav"
          aria-label="移动端导航"
          className="absolute inset-x-0 top-14 border-t border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-950"
        >
          <ul className="grid gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm',
                      isActive
                        ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-400',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
      <div className="relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          to="/"
          className="font-mono text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
        >
          fangmuyang<span className="text-brand-600 dark:text-brand-500">.resume</span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* key 让路由变化时抽屉状态自动重置，见本文件顶部说明 */}
          <MobileNav key={location.pathname} className="md:hidden" />
        </div>
      </div>
    </header>
  );
}
