/**
 * 日期与文本格式化。
 *
 * 内容里的日期是 ISO 字符串（'2023-09-01'），页面需要的是中文可读形式。
 * 集中在这里而不是散在组件里，改一次口径就能全站生效。
 */

/**
 * '2023-09-01' → '2023 年 9 月'
 *
 * 刻意不用 `new Date()` + toLocaleDateString：
 * 那样会引入时区问题（'2023-09-01' 按 UTC 解析，在西半球可能显示成 8 月），
 * 而这里做的是**纯文本变换**，直接切字符串没有任何时区风险。
 */
export function formatYearMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-');

  if (year === undefined || month === undefined) return isoDate;

  return `${year} 年 ${Number(month)} 月`;
}

/**
 * 起止区间 → '2023 年 9 月 — 2026 年 6 月'
 * end 为 null 表示仍在进行，显示为「至今」。
 */
export function formatPeriod(period: { start: string; end: string | null }): string {
  const start = formatYearMonth(period.start);
  const end = period.end === null ? '至今' : formatYearMonth(period.end);

  return `${start} — ${end}`;
}

/** 取年月中的「2023」，用于时间线左侧的年份标记 */
export function formatYear(isoDate: string): string {
  return isoDate.slice(0, 4);
}
