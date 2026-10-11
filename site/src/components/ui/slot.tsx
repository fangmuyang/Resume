import { Children, cloneElement, isValidElement, type ReactElement, type Ref } from 'react';

import { cn } from '@/lib/utils';

/**
 * Slot 是纯粹的 props 透传层，因此刻意**不声明**自己渲染成什么元素。
 * 消费方（如 Button）通过自己的 props 类型保证正确性，Slot 只负责转发。
 */
export interface SlotProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * 显式写成 `| undefined`。
   * 开启 exactOptionalPropertyTypes 后，`ref?: Ref<unknown>` 的含义是
   * "这个键可以不存在，但存在时不能是 undefined"，
   * 而从 Button 透传过来的 ref 恰恰可能是 undefined。
   */
  ref?: Ref<unknown> | undefined;
  [prop: string]: unknown;
}

/**
 * Slot：把自己的 props 与样式「合并到唯一子元素」上，而不是额外包一层标签。
 *
 * 为什么需要它：
 * 想让一个 <Link>（渲染成 <a>）长得像按钮，直觉写法是
 *   <Button><Link to="/">首页</Link></Button>
 * 但这样会产出 `<button><a>…</a></button>` —— HTML 规范不允许交互元素互相嵌套，
 * 浏览器会做出不可预期的行为，无障碍上也是错的。
 *
 * 正确做法是把按钮样式**合并到 Link 自己身上**，最终 DOM 里只有一个 <a>。
 * 这就是 Radix 的 asChild 模式，这里用不到 30 行实现一遍，
 * 顺便理解它的原理：克隆子元素 + 合并 className 与 ref。
 */
export function Slot({ children, className, ref, ...props }: SlotProps) {
  const child = Children.only(children);

  if (!isValidElement(child)) {
    throw new Error('Slot 需要一个有效的 React 元素作为唯一子节点');
  }

  const element = child as ReactElement<Record<string, unknown>>;

  return cloneElement(element, {
    ...props,
    // 两边的 className 都要保留，否则调用方传入的样式会被丢掉
    className: cn(className, element.props['className'] as string | undefined),
    // 子元素自带 ref 时优先用它，避免覆盖使用方自己的 ref
    ref: element.props['ref'] ?? ref,
  });
}
