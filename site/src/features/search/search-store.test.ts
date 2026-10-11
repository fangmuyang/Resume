/**
 * 搜索快捷键判定与状态测试。
 *
 * `isSearchShortcut` 是纯函数，但它的边界值得一提：
 * 大写锁定、Shift 组合、只按 K、只按 Ctrl —— 这些情况写错的症状是
 * "有时候能唤起有时候不能"，很难复现。用测试把行为固定下来最划算。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { isSearchShortcut, useSearchStore } from '@/features/search/search-store';

/** 造一个键盘事件的最小形状 */
function keyEvent(overrides: Partial<{ key: string; metaKey: boolean; ctrlKey: boolean }> = {}) {
  return { key: 'k', metaKey: false, ctrlKey: false, ...overrides };
}

describe('isSearchShortcut', () => {
  it('识别 Ctrl+K（Windows / Linux）', () => {
    expect(isSearchShortcut(keyEvent({ ctrlKey: true }))).toBe(true);
  });

  it('识别 Cmd+K（macOS）', () => {
    expect(isSearchShortcut(keyEvent({ metaKey: true }))).toBe(true);
  });

  it('大写 K 也能识别', () => {
    // 开启大写锁定或按住 Shift 时 key 是 'K'。
    // 实现里用 toLowerCase() 处理，这个行为值得固定下来 ——
    // 少了它会变成"开了大写锁定就搜不了"，很难联想到原因
    expect(isSearchShortcut(keyEvent({ ctrlKey: true, key: 'K' }))).toBe(true);
  });

  it('没有修饰键时不触发', () => {
    expect(isSearchShortcut(keyEvent())).toBe(false);
  });

  it('修饰键组合错误的字母不触发', () => {
    expect(isSearchShortcut(keyEvent({ ctrlKey: true, key: 'j' }))).toBe(false);
  });

  it('只按 K 不触发', () => {
    expect(isSearchShortcut(keyEvent({ key: 'k' }))).toBe(false);
  });

  it('同时按 Ctrl 和 Cmd 也触发', () => {
    expect(isSearchShortcut(keyEvent({ ctrlKey: true, metaKey: true }))).toBe(true);
  });
});

describe('useSearchStore', () => {
  // Zustand 的 store 是模块级单例，用例之间必须重置，否则会相互污染
  beforeEach(() => {
    useSearchStore.setState({ isOpen: false });
  });

  it('初始状态是关闭', () => {
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('open 打开面板', () => {
    useSearchStore.getState().open();

    expect(useSearchStore.getState().isOpen).toBe(true);
  });

  it('close 关闭面板', () => {
    useSearchStore.getState().open();
    useSearchStore.getState().close();

    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('toggle 在两种状态间切换', () => {
    useSearchStore.getState().toggle();
    expect(useSearchStore.getState().isOpen).toBe(true);

    useSearchStore.getState().toggle();
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('重复 open 不产生副作用', () => {
    useSearchStore.getState().open();
    useSearchStore.getState().open();

    expect(useSearchStore.getState().isOpen).toBe(true);
  });

  it('关闭状态下的 close 保持关闭', () => {
    useSearchStore.getState().close();

    expect(useSearchStore.getState().isOpen).toBe(false);
  });
});
