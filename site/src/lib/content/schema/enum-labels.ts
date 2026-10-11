import { z } from 'zod';

/**
 * 枚举值的展示标签。
 *
 * ## 为什么需要这个文件
 *
 * 数据模型里用英文枚举（`completed` / `active` / `archived`）是正确的 ——
 * 它们是**稳定的标识符**，不该随展示语言变化。
 * 但界面上要显示中文，于是就出现了"把中文标签写进组件"的诱惑。
 *
 * 阶段 10 的零硬编码守卫扩大到整个 `src/` 后，这个问题立刻暴露了：
 * `project-card.tsx` 里有一张 `{ completed: { label: '已完成' } }` 的映射表。
 *
 * 为什么不把 label 直接放进每个项目的 JSON：
 * - 项目文件的 `status` 是枚举，加一个并行的 `statusLabel` 就产生了
 *   **两处可能不一致**的数据；
 * - 而且每新增一个项目都要重复写一遍相同的中文。
 *
 * 放在这里的好处是"一处定义、全局一致"，且改文案不需要动代码。
 */
export const enumLabelsSchema = z.object({
  /** 项目状态 */
  projectStatus: z.object({
    active: z.string().min(1),
    completed: z.string().min(1),
    archived: z.string().min(1),
  }),
  /** 联系表单的主题选项 */
  contactTopic: z.object({
    job: z.string().min(1),
    project: z.string().min(1),
    feedback: z.string().min(1),
    other: z.string().min(1),
  }),
});

export type EnumLabels = z.infer<typeof enumLabelsSchema>;
