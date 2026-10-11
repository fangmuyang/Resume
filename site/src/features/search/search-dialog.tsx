import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import { useSearchStore, SEARCH_SHORTCUT_LABEL } from '@/features/search/search-store';
import {
  SEARCH_KIND_LABEL,
  searchContent,
  type SearchEntryKind,
  type SearchHit,
} from '@/features/search/search-index';
import { cn } from '@/lib/utils';

/**
 * 搜索面板。
 *
 * ## 用原生 <dialog> + showModal()，而不是自己实现模态框
 *
 * 手写模态框要处理一堆细节：焦点陷阱、`Escape` 关闭、点击遮罩关闭、
 * `aria-modal`、背景不可滚动、关闭后焦点归还。这些**浏览器已经内置**在
 * `<dialog>.showModal()` 里，而且实现质量比自己写更可靠（尤其是焦点陷阱，
 * 手写版本几乎都有漏洞）。
 *
 * React 里只需要用 effect 同步"store 的开关状态"与"DOM 的模态状态"——
 * 这正是 effect 的正当用途：**把 React 状态同步到外部系统（DOM API）**。
 *
 * ## 为什么输入框状态不放进 store
 *
 * 查询词只在面板内部使用，面板关闭后就应该丢掉。
 * 放进全局 store 会让"关闭再打开还残留上次的搜索词"，
 * 那不是用户想要的。
 */
export function SearchDialog() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const close = useSearchStore((state) => state.close);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const hits = useMemo(() => searchContent(query), [query]);

  // 把 React 状态同步到 DOM 的模态状态（effect 的正当用途）
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // 关闭时重置查询与选中项，下次打开是干净状态。
  // 放在 store.close() 的调用路径上而不是 effect 里 ——
  // 在 effect 里同步 setState 会触发级联渲染。
  const handleClose = (): void => {
    setQuery('');
    setActiveIndex(0);
    close();
  };

  // activeIndex 可能超出新的结果范围（输入变化后结果变少），这里夹紧它
  const safeActiveIndex = hits.length === 0 ? 0 : Math.min(activeIndex, hits.length - 1);

  const goTo = (hit: SearchHit): void => {
    handleClose();
    void navigate(hit.entry.href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (hits.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % hits.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + hits.length) % hits.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[safeActiveIndex];
      if (hit !== undefined) goTo(hit);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      // onCancel 是 <dialog> 在按 Escape 时触发的事件。
      // 必须 preventDefault + 自己关，否则 DOM 关了但 store 还以为是开的，
      // 下次点按钮就打不开了（状态与 DOM 失同步）。
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClick={(event) => {
        // 点击遮罩区域关闭：dialog 自身收到点击说明点在遮罩上（内容区有自己的 onClick 阻断）
        if (event.target === dialogRef.current) handleClose();
      }}
      onKeyDown={handleKeyDown}
      aria-label="站内搜索"
      className="m-auto w-[min(38rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
        <Search aria-hidden className="size-4 shrink-0 text-slate-400" />
        <input
          // autoFocus 只在首次打开时生效；重新打开时 dialog 会恢复上次焦点，
          // 所以关闭时重置 query 也顺带让输入框为空
          autoFocus
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder="搜索项目、文章、技能…"
          // 组合框语义：输入框控制下方列表，屏幕阅读器能关联起来
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls="search-results"
          aria-autocomplete="list"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden shrink-0 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block dark:border-slate-700 dark:text-slate-400">
          Esc
        </kbd>
      </div>

      <div
        id="search-results"
        role="listbox"
        aria-label="搜索结果"
        className="max-h-80 overflow-y-auto p-2"
      >
        {query.trim() === '' ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            输入关键词开始搜索，或用 {SEARCH_SHORTCUT_LABEL} 随时唤起
          </p>
        ) : hits.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            没有找到与「{query}」相关的内容
          </p>
        ) : (
          <ul className="grid gap-0.5">
            {hits.map((hit, index) => (
              <SearchResultItem
                key={hit.entry.id}
                hit={hit}
                isActive={index === safeActiveIndex}
                onSelect={() => goTo(hit)}
                onHover={() => setActiveIndex(index)}
              />
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

/** 类型对应的徽章配色。放这里而不是索引模块：它是展示细节 */
const KIND_CLASS: Record<SearchEntryKind, string> = {
  project: 'border-brand-500/40 text-brand-600 dark:text-brand-500',
  post: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  skill: 'border-slate-300 text-slate-600 dark:text-slate-400',
  page: 'border-slate-300 text-slate-500 dark:text-slate-500',
};

interface SearchResultItemProps {
  hit: SearchHit;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function SearchResultItem({ hit, isActive, onSelect, onHover }: SearchResultItemProps) {
  const { entry } = hit;

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
          isActive
            ? 'bg-slate-100 dark:bg-slate-800'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
        )}
      >
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
            KIND_CLASS[entry.kind],
          )}
        >
          {SEARCH_KIND_LABEL[entry.kind]}
        </span>

        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-medium">{entry.title}</span>
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {entry.description}
          </span>
        </span>
      </button>
    </li>
  );
}
