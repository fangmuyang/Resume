import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Outlet, useLocation } from 'react-router';

import { pageTransitionConfig, pageTransitionVariants, reducedMotionVariants } from '@/lib/motion';

/**
 * 路由切换的入场过渡。
 *
 * 两个关键点：
 *
 * 1. **key 必须是路由标识**。AnimatePresence 靠 key 判断"这是不是同一个元素"，
 *    如果 key 恒定不变，它就不会触发退出/进入动画，过渡会静默失效。
 *    这里用 pathname。
 *
 * 2. **尊重 prefers-reduced-motion**。位移对前庭功能敏感的用户不友好，
 *    所以系统开启"减少动态效果"时降级为纯淡入。
 */
export function PageTransition() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={prefersReducedMotion === true ? reducedMotionVariants : pageTransitionVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={pageTransitionConfig}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
