import { z } from 'zod';

/**
 * `public/` 下静态资产的声明。
 *
 * ## 为什么需要单独声明，而不是在组件里写文件名
 *
 * 文件名（如 `resume.pdf`）属于内容事实 —— 你可能想换成 `fangruijie-resume.pdf`，
 * 而它在页面上是可见的（作为下载链接的名字）。项目有一条守卫
 * `pnpm verify:content`：页面组件里不允许出现来自 content/ 的事实字符串。
 *
 * 所以资产也走内容管道的常规路径：**声明在 JSON 里，组件只读字段**。
 * 这样改文件名只需要改一处，而且守卫能继续工作。
 */
export const resumeAssetSchema = z.object({
  /**
   * 放在 public/ 下的文件名（不含前导斜杠）。
   *
   * 这个字段**不参与** `verify:content` 的硬编码检查 ——
   * 公开文件被组件按名字引用是完全正常的（`/resume.pdf` 就是个 URL），
   * 把它算作"硬编码内容"只会制造误报。见 scripts/verify-content-usage.ts 的 IGNORED_FIELDS。
   */
  file: z.string().min(1),
  /** 展示给用户看的中文标签 */
  label: z.string().min(1),
  /** 页面描述里用的说明 */
  description: z.string().min(1),
  /** 文件体积（字节）。用于在下载按钮旁显示"约 1.8 MB"这类提示 */
  sizeBytes: z.number().int().positive(),
});

export type ResumeAsset = z.infer<typeof resumeAssetSchema>;
