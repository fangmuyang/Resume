import { Terminal, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MDX 里可用的自定义组件集合。
 *
 * 这是 MDX 相对于普通 Markdown 的核心价值：**正文里能直接使用 React 组件**。
 * 普通 Markdown 只能表达"标题 / 段落 / 代码块"这些固定结构，
 * 而这里可以把一段"命令 + 输出"封装成带样式的组件，写作时只需要一行标签。
 *
 * 通过 @mdx-js/react 的 MDXProvider 注入（见 pages/post-detail.tsx），
 * 因此每篇文章都不需要重复 import。
 */

export interface CalloutProps {
  children: ReactNode;
  /** 语气：note 是中性说明，warn 是需要警惕的坑 */
  tone?: 'note' | 'warn';
  title?: string;
}

export function Callout({ children, tone = 'note', title }: CalloutProps) {
  const isWarn = tone === 'warn';

  return (
    <aside
      className={cn(
        'my-6 rounded-lg border px-4 py-3 text-sm',
        isWarn
          ? 'border-amber-400/60 bg-amber-50/60 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300'
          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
      )}
    >
      {title !== undefined ? (
        <p className="mb-1.5 flex items-center gap-2 font-medium">
          {isWarn ? (
            <TriangleAlert aria-hidden className="size-4" />
          ) : (
            <Terminal aria-hidden className="size-4" />
          )}
          {title}
        </p>
      ) : null}
      <div className="[&>p]:m-0 [&>p+p]:mt-2">{children}</div>
    </aside>
  );
}

/**
 * 终端会话：命令与输出分开呈现，比塞进一个代码块更清楚。
 *
 * 实际用法（在 .mdx 文件里）：
 *
 * ```mdx
 * <TerminalSession command="pnpm build" output="✓ built in 891ms" />
 * ```
 */
export function TerminalSession({
  command,
  output,
  tone = 'normal',
}: {
  command: string;
  output: string;
  /** error 用于把输出标红，表示"这不该发生" */
  tone?: 'normal' | 'error';
}) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        <span aria-hidden className="flex gap-1">
          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="size-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        </span>
        <code className="font-mono text-xs text-slate-600 dark:text-slate-400">$ {command}</code>
      </div>
      <pre
        className={cn(
          'overflow-x-auto px-3 py-2 font-mono text-xs',
          tone === 'error'
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-600 dark:text-slate-400',
        )}
      >
        {output}
      </pre>
    </div>
  );
}
