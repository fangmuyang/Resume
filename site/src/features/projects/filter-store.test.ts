/**
 * 作品集筛选状态（URL 同步）的纯函数测试。
 *
 * 这里只测纯函数部分（解析、序列化、切换），不测 React 组件 ——
 * 涉及 URL 的组件行为用 E2E 覆盖更真实（阶段 9 的 Playwright 用例）。
 *
 * 重点在**边界**：URL 参数是用户可编辑的字符串，什么内容都可能出现。
 * 如果解析不够健壮，一个手改的 URL 就能让页面崩溃或显示错误结果。
 */
import { describe, expect, it } from 'vitest';

import { parseTags, serializeTags, toggleTag } from '@/features/projects/filter-store';

describe('parseTags', () => {
  it('null 返回空数组', () => {
    expect(parseTags(null)).toEqual([]);
  });

  it('按逗号切分', () => {
    expect(parseTags('React,Vue')).toEqual(['React', 'Vue']);
  });

  it('去掉空白项与首尾空格', () => {
    // 用户手改 URL 时很容易带上空格或多余逗号
    expect(parseTags(' React , ,Vue ')).toEqual(['React', 'Vue']);
  });

  it('去重但保留首次出现的顺序', () => {
    expect(parseTags('Vue,React,Vue')).toEqual(['Vue', 'React']);
  });

  it('全空白返回空数组', () => {
    expect(parseTags(' , , ')).toEqual([]);
  });

  it('空字符串返回空数组', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('单个标签正常工作', () => {
    expect(parseTags('React')).toEqual(['React']);
  });
});

describe('serializeTags', () => {
  it('空数组返回 null', () => {
    // 返回 null 而不是空字符串，是为了让调用方知道"应该把这个参数从 URL 里删掉"，
    // 而不是留下一个 `?tags=` 这种难看的空参数
    expect(serializeTags([])).toBeNull();
  });

  it('多个标签用逗号连接', () => {
    expect(serializeTags(['React', 'Vue'])).toBe('React,Vue');
  });

  it('单个标签不加分隔符', () => {
    expect(serializeTags(['React'])).toBe('React');
  });
});

describe('parseTags 与 serializeTags 互逆', () => {
  it('往返后结果一致', () => {
    const original = ['React', 'TypeScript', '移动端'];
    const serialized = serializeTags(original);

    expect(serialized).not.toBeNull();
    expect(parseTags(serialized)).toEqual(original);
  });

  it('空数组往返后仍为空', () => {
    expect(parseTags(serializeTags([]))).toEqual([]);
  });
});

describe('toggleTag', () => {
  it('未选中时加入', () => {
    expect(toggleTag(['React'], 'Vue')).toEqual(['React', 'Vue']);
  });

  it('已选中时移除', () => {
    expect(toggleTag(['React', 'Vue'], 'React')).toEqual(['Vue']);
  });

  it('移除最后一个后返回空数组', () => {
    expect(toggleTag(['React'], 'React')).toEqual([]);
  });

  it('不修改传入数组', () => {
    // 直接改动传入数组会让 React 的状态更新检测失效（引用没变）
    const original = ['React'];

    toggleTag(original, 'Vue');

    expect(original).toEqual(['React']);
  });

  it('连续切换两次回到原状态', () => {
    const start = ['React'];
    const after = toggleTag(toggleTag(start, 'Vue'), 'Vue');

    expect(after).toEqual(start);
  });
});
