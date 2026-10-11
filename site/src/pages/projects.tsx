import { PagePlaceholder } from '@/components/page-placeholder';

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      stage="阶段 4"
      title="项目与作品"
      description="作品集列表，支持按技术栈筛选，并带详情页。四个项目的概要数据已就绪，详情待人工补充。"
      bullets={[
        '按 tech / tags 做多标签筛选，筛选状态放进 URL 查询参数',
        '详情页路由 /projects/:slug，用 loader 取数据',
        '卡片入场动画与图片懒加载',
        '详情内容需要先补齐 content/projects/*.json 里的 TODO',
      ]}
    />
  );
}
