import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface TagFilterProps {
  /** 全部可选标签 */
  tags: readonly string[];
  /** 当前选中的标签 */
  selected: readonly string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  /** 当前筛选结果数量，用于给出即时反馈 */
  resultCount: number;
  className?: string;
}

/**
 * 标签筛选条。
 *
 * 无障碍上做了三件事，都是筛选类组件容易漏的：
 * 1. 用 `aria-pressed` 表达"已选中"，而不是只靠颜色 —— 屏幕阅读器能读出来；
 * 2. 每个按钮有明确的可访问名称（就是标签文字本身），不需要额外 aria-label；
 * 3. 结果数量用 `aria-live="polite"` 播报，让屏幕阅读器用户知道筛选生效了。
 */
export function TagFilter({
  tags,
  selected,
  onToggle,
  onClear,
  resultCount,
  className,
}: TagFilterProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-slate-400">按标签筛选</span>

        {tags.map((tag) => {
          const isSelected = selected.includes(tag);

          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-500 border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400',
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* aria-live 让屏幕阅读器在筛选变化时播报结果数量 */}
        <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
          共 {resultCount} 个项目
          {selected.length > 0 ? `（已选 ${selected.length} 个标签）` : ''}
        </p>

        {selected.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="size-3.5" />
            清除筛选
          </button>
        ) : null}
      </div>
    </div>
  );
}
