import { ArrowLeft, Calendar, ExternalLink, UserRound } from 'lucide-react';
import { Link, useLoaderData } from 'react-router';

import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { ProjectCard } from '@/features/projects/project-card';
import type { projectDetailLoader } from '@/features/projects/project-detail-loader';
import { formatPeriod } from '@/lib/format';
import { resolveAssetUrl } from '@/lib/projects';
import { Seo } from '@/lib/seo/seo';

/** 详情页的内容分区。用数据描述结构，避免四段几乎相同的 JSX 重复四遍。 */
const SECTIONS = [
  { key: 'background', title: '项目背景', variant: 'prose' },
  { key: 'contributions', title: '我负责的部分', variant: 'list' },
  { key: 'approaches', title: '技术方案', variant: 'list' },
  { key: 'challenges', title: '难点与解决', variant: 'list' },
  { key: 'results', title: '成果', variant: 'list' },
] as const;

/**
 * 作品集详情页。
 *
 * 数据来自 loader（见 project-detail-loader.ts）：组件里拿到的 project
 * 一定是存在的，因此不需要任何"可能为 undefined"的分支。
 */
export default function ProjectDetailPage() {
  const { project, related } = useLoaderData<typeof projectDetailLoader>();

  const cover = resolveAssetUrl(project.cover);
  const sections = SECTIONS.map((section) => ({
    ...section,
    value: project[section.key],
  })).filter((section) => (Array.isArray(section.value) ? section.value.length > 0 : true));

  return (
    <Container className="py-16">
      <Seo
        title={project.name}
        // 摘要是待补充占位时，退化成"角色 + 技术栈"，避免把 TODO 文案送进搜索结果
        description={
          project.summary.startsWith('TODO:')
            ? `${project.name}：${project.role}，使用 ${project.tech.join('、')}。`
            : project.summary
        }
        path={`/projects/${project.slug}`}
        type="article"
      />

      <Reveal>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="size-4" />
          返回项目列表
        </Link>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">{project.name}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <UserRound aria-hidden className="size-4" />
            {project.role}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar aria-hidden className="size-4" />
            {formatPeriod(project.period)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...project.tech, ...project.tags].map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {project.links.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {project.links.map((link) => (
              <Button key={link.href} variant="outline" asChild>
                <a href={link.href} target="_blank" rel="noreferrer noopener">
                  {link.label}
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            ))}
          </div>
        ) : null}
      </Reveal>

      {cover !== null ? (
        <Reveal className="mt-10">
          <img
            src={cover}
            alt={`${project.name} 界面截图`}
            decoding="async"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800"
          />
        </Reveal>
      ) : null}

      {/* 截图集：没有图片时整块不渲染 */}
      {project.screenshots.length > 0 ? (
        <RevealList className="mt-4 grid gap-4 sm:grid-cols-2">
          {project.screenshots.map((screenshot) => {
            const url = resolveAssetUrl(screenshot);
            return url === null ? null : (
              <RevealItem key={screenshot}>
                <img
                  src={url}
                  alt={`${project.name} 截图`}
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800"
                />
              </RevealItem>
            );
          })}
        </RevealList>
      ) : null}

      {sections.map((section) => (
        <Reveal key={section.key} className="mt-12">
          <section className="grid gap-4">
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>

            {Array.isArray(section.value) ? (
              <ul className="grid gap-2">
                {section.value.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600"
                    />
                    <TextWithPlaceholder
                      text={item}
                      className="flex-1 leading-relaxed text-slate-600 dark:text-slate-400"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <TextWithPlaceholder
                text={section.value}
                className="max-w-prose leading-relaxed text-slate-600 dark:text-slate-400"
              />
            )}
          </section>
        </Reveal>
      ))}

      {related.length > 0 ? (
        <section className="mt-16 grid gap-6">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight">相关项目</h2>
          </Reveal>

          <RevealList className="grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <RevealItem key={item.slug}>
                <ProjectCard project={item} className="h-full" />
              </RevealItem>
            ))}
          </RevealList>
        </section>
      ) : null}

      <Reveal className="mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">想看更多？</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/projects">返回项目列表</Link>
            </Button>
          </CardContent>
        </Card>
      </Reveal>
    </Container>
  );
}
