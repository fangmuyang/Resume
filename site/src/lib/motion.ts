/**
 * 集中管理动画参数。
 *
 * 为什么集中：动画时长、缓动曲线一旦散落在各组件里，整站节奏就会变得不一致
 * （有的 0.15s 有的 0.5s，观感上很廉价）。这里作为唯一来源。
 *
 * 无障碍要点：系统设置里打开"减少动态效果"的用户（前庭功能障碍等）
 * 会因为位移动画而不适。useReducedMotion 让我们在这种情况下降级为纯淡入。
 */
import type { Transition, Variants } from 'motion/react';

/**
 * 常用缓动：先快后慢，观感比线性自然。
 *
 * 类型写成具体的四元数组而不是 `Transition['ease']` ——
 * 后者含 undefined，在 exactOptionalPropertyTypes 下无法赋给
 * Transition 的可选 ease 属性（"可以缺失"不等于"可以提供 undefined"）。
 */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const DURATION = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const pageTransitionConfig: Transition = {
  duration: DURATION.base,
  ease: EASE_OUT,
};

/** 列表项逐个入场的间隔，避免所有卡片同时出现 */
export const STAGGER_DELAY = 0.05;
