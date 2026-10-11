/**
 * 基础 Schema 与校验辅助函数。
 *
 * 这个文件体现本项目类型系统的核心思路：
 * **Schema 是唯一真相来源，TypeScript 类型由它推导出来（z.infer）。**
 * 这样运行时校验与编译期类型不可能不一致 —— 不存在"改了类型忘了改校验"的经典 bug。
 */
import { z } from 'zod';

/**
 * ISO 日期字符串，例如 "2026-06-01"。
 * Zod v4 把日期校验收进了 z.iso 命名空间，比 v3 的 z.string().date() 更明确。
 */
export const isoDateSchema = z.iso.date();

/**
 * 带校验的 URL。z.url() 在 Zod v4 里已是顶层 API。
 */
export const urlSchema = z.url();

/**
 * 允许"至今"这类未结束的区间：end 为空表示仍在进行。
 */
export const dateRangeSchema = z
  .object({
    start: isoDateSchema,
    end: isoDateSchema.nullable(),
  })
  .refine((range) => range.end === null || range.end >= range.start, {
    message: 'end 不能早于 start',
    path: ['end'],
  });

export type DateRange = z.infer<typeof dateRangeSchema>;

/**
 * 校验一个未知值，失败时抛出**带文件路径**的错误。
 *
 * 为什么需要它：内容文件写错时，Zod 默认只报"哪个字段不对"，
 * 但不告诉你**是哪个文件**。内容一多，这个信息差就是排查成本。
 */
export function parseWithContext<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');

  throw new Error(`内容校验失败：${source}\n${issues}`);
}
