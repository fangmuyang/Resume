import { PagePlaceholder } from '@/components/page-placeholder';

export default function ResumePage() {
  return (
    <PagePlaceholder
      stage="阶段 6"
      title="简历"
      description="网页版简历，并提供 PDF 预览与下载。"
      bullets={[
        '用 pdfjs-dist 做前端 PDF 预览，避免依赖浏览器内置查看器',
        '下载件保留手机号；网页正文不出现（由 profile.privacy 控制）',
        '支持打印样式，方便直接另存为 PDF',
        '教育经历、项目概览、奖项三块内容已就绪',
      ]}
    />
  );
}
