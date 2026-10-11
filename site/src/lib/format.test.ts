/**
 * 格式化工具的测试。
 *
 * 这两个函数的实现刻意**不用** `new Date()` —— 那会引入时区问题
 * （`'2023-09-01'` 按 UTC 解析，在西半球可能显示成 8 月）。
 * 这个决定正是这里要固定下来的行为：纯文本变换，结果与运行环境无关。
 */
import { describe, expect, it } from 'vitest';

import { formatPeriod, formatYear, formatYearMonth } from '@/lib/format';

describe('formatYearMonth', () => {
  it('转成中文年月', () => {
    expect(formatYearMonth('2023-09-01')).toBe('2023 年 9 月');
  });

  it('月份去掉前导零', () => {
    // '09' → 9，否则会显示成"2023 年 09 月"
    expect(formatYearMonth('2023-09-01')).not.toContain('09');
  });

  it('处理 1 月与 12 月', () => {
    expect(formatYearMonth('2025-01-15')).toBe('2025 年 1 月');
    expect(formatYearMonth('2025-12-31')).toBe('2025 年 12 月');
  });

  it('忽略日部分', () => {
    expect(formatYearMonth('2025-03-01')).toBe(formatYearMonth('2025-03-28'));
  });

  it('接受只有年月的输入', () => {
    expect(formatYearMonth('2025-06')).toBe('2025 年 6 月');
  });

  it('输入格式异常时原样返回，不抛错', () => {
    // 内容文件里的日期是人工维护的，写错格式时应该尽量显示而不是崩溃
    expect(formatYearMonth('2025')).toBe('2025');
    expect(formatYearMonth('')).toBe('');
  });
});

describe('formatPeriod', () => {
  it('起止都有值时显示区间', () => {
    expect(formatPeriod({ start: '2023-09-01', end: '2026-06-01' })).toBe(
      '2023 年 9 月 — 2026 年 6 月',
    );
  });

  it('end 为 null 时显示「至今」', () => {
    expect(formatPeriod({ start: '2025-02-01', end: null })).toBe('2025 年 2 月 — 至今');
  });
});

describe('formatYear', () => {
  it('取前四位作为年份', () => {
    expect(formatYear('2023-09-01')).toBe('2023');
  });
});
