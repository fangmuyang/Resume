import { X } from 'lucide-react';

import type { TagMatchMode } from '@/lib/projects';
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
  /** 多标签时的匹配语义：any = 任一命中，all = 全部命中 */
  matchMode: TagMatchMode;
  onMatchModeChange: (mode: TagMatchMode) => void;
  className?: string;
}

/**
 * 标签筛选条。
 *
 * 无障碍上做了四件事，都是筛选类组件容易漏的：
 * 1. 用 `aria-pressed` 表达"已选中"，而不是只靠颜色 —— 屏幕阅读器能读出来；
 * 2. 每个按钮有明确的可访问名称（就是标签文字本身），不需要额外 aria-label；
 * 3. 结果数量用 `aria-live="polite"` 播报，让屏幕阅读器用户知道筛选生效了；
 * 4. 匹配语义用 `radiogroup` 而不是两个按钮 —— 它是"二选一"，不是"开关"。
 */
export function TagFilter({
  tags,
  selected,
  onToggle,
  onClear,
  resultCount,
  matchMode,
  onMatchModeChange,
  className,
}: TagFilterProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      {/*
        role="group" + aria-label 让这一组按钮成为一个有名字的整体。
        两个好处：
        1. 无障碍上更准确 —— 屏幕阅读器会播报"标签筛选，分组"，
           用户知道这组按钮的用途是什么；
        2. 让"筛选器里的 Vue 按钮"与"项目卡片里的 Vue 标签"可以区分。
           否则同一个标签名会在页面上出现多次（卡片也会渲染标签），
           按名称定位会命中多个元素 —— E2E 用例第一次跑起来时就撞上了这一点。
      */}
      <div role="group" aria-label="标签筛选" className="flex flex-wrap items-center gap-2">
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

        {/*
          匹配语义只在选中两个及以上标签时才有意义 ——
          一个标签时"任一"和"全部"结果完全相同，显示出来只会造成困惑。
        */}
        {selected.length > 1 ? (
          <div
            role="radiogroup"
            aria-label="标签匹配方式"
            className="flex items-center gap-1 rounded-full border border-slate-200 p-0.5 dark:border-slate-700"
          >
            {(
              [
                { value: 'any', label: '任一标签' },
                { value: 'all', label: '全部标签' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                // role=radio 的元素用 aria-checked 表达选中态，而不是 aria-pressed
                role="radio"
                aria-checked={matchMode === option.value}
                onClick={() => onMatchModeChange(option.value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  matchMode === option.value
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

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
