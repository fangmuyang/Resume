import { PagePlaceholder } from '@/components/page-placeholder';

export default function AboutPage() {
  return (
    <PagePlaceholder
      stage="阶段 3"
      title="关于我"
      description="个人简介、教育经历时间线、技能分组与获奖情况。数据已就绪，等待阶段 3 的版式与动画。"
      bullets={[
        '把 profile.bio 扩展成完整的自我介绍段落',
        '教育经历做成竖向时间线，突出排名与奖学金',
        '技能分组按能力域展示，并接入站内搜索索引',
        '滚动入场动画（Framer Motion 的 whileInView）',
      ]}
    />
  );
}
