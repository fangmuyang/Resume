import { PagePlaceholder } from '@/components/page-placeholder';

export default function ContactPage() {
  return (
    <PagePlaceholder
      stage="阶段 7"
      title="联系方式"
      description="邮箱与联系表单。手机号默认不公开展示。"
      bullets={[
        'React Hook Form + Zod 做表单与校验，复用内容管道的 schema 思路',
        '展示 profile.links 里 public 为 true 的链接',
        '表单提交为前端模拟，并把状态机（idle/submitting/success/error）讲清楚',
        '无障碍：每个输入都有 label，错误信息用 aria-describedby 关联',
      ]}
    />
  );
}
