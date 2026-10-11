import { PagePlaceholder } from '@/components/page-placeholder';

export default function PostsPage() {
  return (
    <PagePlaceholder
      stage="阶段 5"
      title="笔记与文章"
      description="用 MDX 写的技术笔记，可在 Markdown 里直接嵌入 React 组件。"
      bullets={[
        '接入 @mdx-js/rollup，构建期收集 content/posts/*.mdx',
        '代码高亮用 rehype-pretty-code + shiki',
        '文章列表与详情页，支持标签分类',
        '先写 2–3 篇学习笔记作为真实内容',
      ]}
    />
  );
}
