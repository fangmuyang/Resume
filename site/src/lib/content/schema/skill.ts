import { z } from 'zod';

/**
 * 技能分组。技能用分组 + 条目两级结构，
 * 便于「关于我」页按类别渲染，也便于后续按分组生成搜索索引。
 */
export const skillGroupSchema = z.object({
  /** 稳定标识，用于锚点与测试选择器 */
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'id 只能是小写字母、数字与连字符，且以字母开头'),
  label: z.string().min(1),
  items: z.array(z.string().min(1)).min(1, '每个技能分组至少要有 1 项'),
});

export type SkillGroup = z.infer<typeof skillGroupSchema>;

export const skillGroupsSchema = z
  .array(skillGroupSchema)
  .min(1)
  .refine(
    (groups) => new Set(groups.map((group) => group.id)).size === groups.length,
    '技能分组的 id 不能重复',
  );
