import { CircleDashed } from 'lucide-react';

import { isPlaceholder } from '@/lib/content-placeholder';
import { cn } from '@/lib/utils';

/**
 * 把尚未填写的内容占位渲染成醒目的提示块。
 *
 * 内容管道用 `TODO:说明` 标记待补字段（见 scripts/extract-pdf.ts）。
 * 直接渲染会显示生硬的 "TODO:一句话自我介绍…"；悄悄替换成空字符串同样有害 ——
 * 你会忘记还有内容没写。
 *
 * 所以这里选第三条路：**保留这个事实，但把它渲染成一眼可辨的提示块**。
 * 发布前应清空所有 TODO，`pnpm validate` 会统计剩余数量。
 *
 * 判定函数 isPlaceholder 放在 lib/ 而不是本文件：本文件只应导出组件，
 * 否则 React Fast Refresh 会退化成整页刷新。
 */
export interface TextWithPlaceholderProps {
  text: string;
  className?: string;
}

export function TextWithPlaceholder({ text, className }: TextWithPlaceholderProps) {
  if (!isPlaceholder(text)) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-md border border-dashed border-amber-400/60 bg-amber-50/60 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-400',
        className,
      )}
    >
      {/* aria-hidden：图标只是视觉提示，文字本身已经说明了状态 */}
      <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium">待补充：</span>
        {text.slice('TODO:'.length)}
      </span>
    </p>
  );
}
