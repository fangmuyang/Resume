import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 className 的工具函数。
 *
 * 为什么需要两件事而不是一个：
 * - clsx：处理条件类名（对象、数组、假值过滤）；
 * - tailwind-merge：解决 Tailwind 的**冲突覆盖**问题。
 *
 * 关键在于第二点。Tailwind 生成的类没有优先级概念，谁在 CSS 里靠后谁生效，
 * 所以 `<Button className="bg-red-500">` 想覆盖组件内置的 `bg-brand-600`
 * 时，只靠拼接字符串结果是不确定的。
 * twMerge 认识 Tailwind 的类名语义，会把冲突的前者删掉，让覆盖变得可预期 ——
 * 这是"可组合组件"能工作的前提。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
