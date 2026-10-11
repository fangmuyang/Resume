import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

import { DURATION, EASE_OUT, STAGGER_DELAY } from '@/lib/motion';

/**
 * 需要支持哪些标签就显式列出来。
 *
 * 为什么不写 `motion[as]` 动态取值：那样要断言类型，而且传入不存在的标签
 * 会在运行时才炸。显式映射的代价只是多两行，收益是类型安全 + 拼错立刻报错。
 */
const MOTION_ELEMENTS = {
  div: motion.div,
  li: motion.li,
  section: motion.section,
} as const;

export type RevealElement = keyof typeof MOTION_ELEMENTS;

/**
 * 滚动入场动画。
 *
 * 关键技术点是 `viewport={{ once: true }}`：不加这个参数，元素每次滚出再滚入
 * 都会重新播放动画 —— 反复触发会让页面显得廉价，也在反复计算布局。
 *
 * 无障碍：系统开启「减少动态效果」时退化为纯淡入。位移对前庭功能敏感的用户
 * 不友好，这一点与 lib/motion.ts 的处理保持一致。
 */
export interface RevealProps {
  children: ReactNode;
  as?: RevealElement;
  /** 延迟秒数，用于手工错开若干元素的入场时机 */
  delay?: number;
  className?: string;
}

export function Reveal({ children, as = 'div', delay = 0, className }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  const variants: Variants =
    prefersReducedMotion === true
      ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
      : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

  const Component = MOTION_ELEMENTS[as];

  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT, delay }}
    >
      {children}
    </Component>
  );
}

/**
 * 让一批子元素依次入场。
 *
 * 用 variants 的 staggerChildren，而不是给每个子元素手写 delay：
 * 子元素数量变化时不用重算时间，父组件一处配置即可。
 */
export function RevealList({
  children,
  as = 'div',
  className,
}: {
  children: ReactNode;
  as?: RevealElement;
  className?: string;
}) {
  const Component = MOTION_ELEMENTS[as];

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: STAGGER_DELAY } },
      }}
    >
      {children}
    </Component>
  );
}

/** RevealList 的子项，入场时机由父级的 staggerChildren 统一控制 */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  const variants: Variants =
    prefersReducedMotion === true
      ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
      : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

  return (
    <motion.div
      variants={variants}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
