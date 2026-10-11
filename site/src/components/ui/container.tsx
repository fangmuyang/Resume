import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * 统一的页面宽度与内边距。
 *
 * 为什么要抽出来：如果每个页面各写一遍 `mx-auto max-w-5xl px-6`，
 * 迟早会出现某页少写一个而宽度不一致。集中一处才能保证整站栅格统一。
 */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-5xl px-6', className)} {...props} />;
}
