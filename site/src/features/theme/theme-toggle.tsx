import { Moon, Sun } from 'lucide-react';

import { useThemeStore } from '@/features/theme/theme-store';
import { cn } from '@/lib/utils';

/**
 * 主题切换按钮。
 *
 * 这里只做「亮 ⇄ 暗」两态切换，而不是三态下拉：
 * 对个人站点而言这个交互成本最低，系统偏好已经由 store 的初始值处理了。
 * 想扩展成 light/dark/system 三态时，改 useThemeStore 的 setChoice 即可。
 */
export function ThemeToggle({ className }: { className?: string }) {
  const resolved = useThemeStore((state) => state.resolved);
  const toggle = useThemeStore((state) => state.toggle);

  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800',
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
