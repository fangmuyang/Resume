import { Download, Printer } from 'lucide-react';

import { Reveal } from '@/components/motion/reveal';
import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { PdfPreview } from '@/features/resume/pdf-preview';
import { formatFileSize, usePdfPreviewToggle } from '@/features/resume/resume-utils';
import { profile, pageMeta, resume, resumeAsset, skillGroups } from '@/lib/content';
import { formatPeriod } from '@/lib/format';
import { resolveAssetUrl } from '@/lib/projects';
import { Seo } from '@/lib/seo/seo';

/**
 * 简历页：网页版简历 + PDF 预览与下载。
 *
 * ## 隐私处理
 *
 * `profile.privacy` 是内容里的显式开关，本页严格按它渲染：
 * - `showPhone: false` 时，手机号既不出现在正文，也不出现任何链接里；
 * - `allowResumeDownload: false` 时，下载按钮与预览整块不渲染。
 *
 * 这条约束由 `pnpm verify:privacy` 在构建后实测（扫描产物，
 * 确认手机号没有出现在 HTML/JS 文本里），而不是靠"我记得检查"。
 * 见 scripts/verify-privacy.ts。
 */
export default function ResumePage() {
  const { isOpen: isPreviewOpen, toggle: togglePreview } = usePdfPreviewToggle();

  const pdfUrl = resolveAssetUrl(resumeAsset.file);
  const { showPhone, allowResumeDownload } = profile.privacy;

  /**
   * 这里**不需要**再按 privacy 过滤 links。
   *
   * 非公开条目在构建期就被剥离了（见 scripts/build-public-content.ts），
   * 浏览器拿到的 profile 里根本不存在它们。
   * 页面侧少一个判断分支，就少一个写错的机会。
   */
  const visibleLinks = profile.links;

  return (
    <Container className="py-16 print:max-w-none print:py-0">
      <Seo title={pageMeta.resume.title} description={pageMeta.resume.description} path="/resume" />

      <Reveal className="print:hidden">
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">resume</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">简历</h1>
        <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-400">
          {pageMeta.resume.description}
        </p>
      </Reveal>

      {/* ---------- 操作区（打印时隐藏） ---------- */}
      <Reveal className="mt-8 print:hidden">
        <div className="flex flex-wrap gap-3">
          {allowResumeDownload && pdfUrl !== null ? (
            <>
              <Button asChild>
                <a href={pdfUrl} download={resumeAsset.file}>
                  <Download className="size-4" />
                  {resumeAsset.label}
                  <span className="text-xs opacity-75">
                    {formatFileSize(resumeAsset.sizeBytes)}
                  </span>
                </a>
              </Button>

              <Button variant="outline" onClick={togglePreview}>
                {isPreviewOpen ? '收起预览' : '在页面内预览'}
              </Button>
            </>
          ) : null}

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            打印 / 另存为 PDF
          </Button>
        </div>

        {allowResumeDownload && pdfUrl !== null ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {resumeAsset.description}
          </p>
        ) : null}
      </Reveal>

      {/* ---------- PDF 预览（仅展开时加载引擎） ---------- */}
      {allowResumeDownload && isPreviewOpen ? (
        <div className="mt-6 print:hidden">
          <PdfPreview file={resumeAsset.file} />
        </div>
      ) : null}

      {/* ---------- 自述 ---------- */}
      <section className="mt-12 grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">个人自述</h2>
        <TextWithPlaceholder
          text={resume.summary}
          className="max-w-prose leading-relaxed text-slate-600 dark:text-slate-400"
        />
      </section>

      {/* ---------- 教育经历 ---------- */}
      <section className="mt-12 grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">教育经历</h2>

        {resume.education.map((item) => (
          <div key={item.school} className="grid break-inside-avoid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{item.school}</h3>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-500">
                {formatPeriod(item.period)}
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">
              {item.degree} · {item.major}
              {item.rank === null ? '' : ` · ${item.rank}`}
            </p>

            {item.courses.length > 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                主修课程：{item.courses.join('、')}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      {/* ---------- 项目经历 ---------- */}
      <section className="mt-12 grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">项目经历</h2>

        {resume.projects.map((project) => (
          <div key={project.slug} className="grid break-inside-avoid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                {project.name}
                <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                  {project.role}
                </span>
              </h3>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-500">
                {formatPeriod(project.period)}
              </span>
            </div>

            <ul className="grid gap-1.5">
              {project.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 text-sm">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600"
                  />
                  <span className="text-slate-600 dark:text-slate-400">{bullet}</span>
                </li>
              ))}
            </ul>

            {project.tech.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {project.tech.map((tech) => (
                  <Badge key={tech} variant="outline">
                    {tech}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {/* ---------- 获奖 ---------- */}
      {resume.awards.length > 0 ? (
        <section className="mt-12 grid gap-3">
          <h2 className="text-xl font-semibold tracking-tight">获奖情况</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{resume.awards.join(' · ')}</p>
        </section>
      ) : null}

      {/* ---------- 专业技能 ---------- */}
      <section className="mt-12 grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">专业技能</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {skillGroups.map((group) => (
            <Card key={group.id} className="break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {group.items.join('、')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- 联系方式（受隐私开关约束） ---------- */}
      <section className="mt-12 grid gap-3">
        <h2 className="text-xl font-semibold tracking-tight">联系方式</h2>

        <ul className="grid gap-1.5 text-sm">
          {visibleLinks.map((link) => (
            <li key={link.kind}>
              <a
                href={link.value}
                className="text-brand-600 dark:text-brand-500 underline-offset-4 hover:underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {!showPhone ? (
          <p className="text-xs text-slate-500 dark:text-slate-500 print:hidden">
            网页版出于隐私考虑未展示手机号，如需请联系上方邮箱。
          </p>
        ) : null}
      </section>
    </Container>
  );
}
