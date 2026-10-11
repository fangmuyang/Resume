/**
 * 搜索面板的开合状态。
 *
 * ## 为什么这个状态适合放在 Zustand
 *
 * 对比项目里三种状态的处理方式，能看出选择标准：
 *
 * | 状态 | 方案 | 理由 |
 * | --- | --- | --- |
 * | 作品集筛选 | **URL** | 需要可分享、可刷新、可后退 —— 必须可寻址 |
 * | 移动端抽屉 | **局部 useState** | 只有 Header 用，没有跨组件消费 |
 * | 搜索面板 | **Zustand** | 三处不同位置要读写：Header 按钮、全局快捷键、面板自身 |
 *
 * 判断依据是**谁需要读它**，而不是"能不能放进全局 store"。
 *
 * ## 为什么不做持久化
 *
 * 搜索面板的开关是瞬时交互状态，刷新后自动关闭才符合预期。
 * 持久化它反而奇怪 —— 这点和主题状态正好相反。
 */
import { create } from 'zustand';

interface SearchState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

/**
 * 全局打开搜索的快捷键描述。
 *
 * 只声明一次，供两处消费：
 * - Header 按钮的 `title` 提示；
 * - 面板内右侧显示的按键提示。
 * 两边共用一个来源，文案不会不一致。
 */
export const SEARCH_SHORTCUT_LABEL = '⌘K / Ctrl+K';

/**
 * 判断一次键盘事件是否应触发搜索。
 *
 * 抽成纯函数是为了能单独测试（阶段 9 会用到），也避免把平台判断散在组件里。
 */
export function isSearchShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}): boolean {
  // 用 key.toLowerCase() 兼容大写锁定与 Shift 组合
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}
