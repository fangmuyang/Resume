import { z } from 'zod';

/**
 * 联系表单的校验 schema。
 *
 * ## 与内容 schema 的关系
 *
 * 内容管道用 Zod 校验"静态内容是否正确"（构建期，失败即中断构建）；
 * 这里用 Zod 校验"用户输入是否合法"（运行时，失败即显示错误提示）。
 * **同一个库、两种用途** —— 这是 Zod 在本项目里的第二个落地点，
 * 也说明"类型 + 校验同源"这个思路可以贯穿静态内容与动态输入。
 *
 * ## 校验信息写给用户看
 *
 * 每条 message 都是给终端用户的中文提示，而不是给开发者的技术描述。
 * Zod 的默认提示是英文的（"Invalid email"），直接展示给中文用户很突兀，
 * 所以这里逐条覆盖。
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(1, '请填写你的称呼').max(40, '称呼请控制在 40 个字符以内'),

  email: z
    .string()
    .trim()
    .min(1, '请填写邮箱，方便我回复你')
    .email('邮箱格式看起来不对，请检查一下'),

  /** 主题做成枚举而不是自由文本：便于分类，也避免用户随便填 */
  topic: z.enum(['job', 'project', 'feedback', 'other'], {
    message: '请选择一个主题',
  }),

  message: z
    .string()
    .trim()
    .min(10, '内容太短了，至少写 10 个字让我了解你的意图')
    .max(1000, '内容请控制在 1000 字以内'),

  /**
   * 蜜罐字段：正常用户看不到也不会填，机器人往往会填。
   * 前端表单用它做最基础的垃圾提交过滤 —— 注意这不是安全措施，
   * 真正的防护必须在服务端做（本项目没有后端，所以只当演示）。
   *
   * 这里**不加 `.default('')`**：那会让 schema 的输入类型变成
   * `string | undefined` 而输出类型是 `string`。两者不一致时
   * zodResolver 的类型就匹配不上（exactOptionalPropertyTypes 下直接报错）。
   * 空初值由表单的 `defaultValues` 提供，职责更清楚。
   */
  website: z.string().max(0, '此项应留空').optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

/** 主题选项的展示文案。放在 schema 旁边，保证选项与枚举不会脱节 */
export const CONTACT_TOPIC_OPTIONS: readonly {
  value: ContactFormValues['topic'];
  label: string;
}[] = [
  { value: 'job', label: '实习 / 工作机会' },
  { value: 'project', label: '项目合作' },
  { value: 'feedback', label: '对本站的建议' },
  { value: 'other', label: '其他' },
];
