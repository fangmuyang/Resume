import type { ComponentProps } from 'react';

import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants';
import { Slot } from '@/components/ui/slot';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ComponentProps<'button'>, ButtonVariantProps {
  /**
   * 为 true 时把按钮样式合并到唯一子元素上，而不是渲染 <button>。
   * 用于让 <Link> 之类的元素长得像按钮，同时保持 DOM 语义正确。
   * 见 components/ui/slot.tsx 的说明。
   */
  asChild?: boolean;
}

/**
 * 注意这里**没有**用 React.forwardRef。
 * React 19 起 ref 是普通 prop，函数组件直接接收即可 ——
 * 这是 React 19 相对 18 最影响日常写法的变化之一。
 */
export function Button({
  className,
  variant,
  size,
  type = 'button',
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return <Slot className={classes} {...props} />;
  }

  return <button type={type} className={classes} {...props} />;
}
