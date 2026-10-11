import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { featuredProjects, pageMeta, profile, resume, skillGroups } from '@/lib/content';
import { formatPeriod } from '@/lib/format';
import { Seo, StructuredData } from '@/lib/seo/seo';
import { buildWebsiteStructuredData } from '@/lib/seo/structured-data';

/**
 * 首页。
 *
 * 结构：Hero → 精选项目 → 能力概览 → 教育背景。
 * 所有内容性文字都来自 content/，组件里只有分区标题这类结构性文本。
 */
export default function HomePage() {
  const education = resume.education[0];

  return (
    <Container className="py-16">
      <Seo title={pageMeta.home.title} description={pageMeta.home.description} path="/" />
      {/* 站点级结构化数据放在首页：搜索引擎从这里建立"站点是什么"的认知 */}
      <StructuredData data={buildWebsiteStructuredData()} />

      {/* ---------- Hero ---------- */}
      <Reveal>
        <section className="grid gap-6">
          <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">{profile.headline}</p>

          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {profile.name}
          </h1>

          <TextWithPlaceholder
            text={profile.bio}
            className="max-w-prose leading-relaxed text-pretty text-slate-600 dark:text-slate-400"
          />

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/projects">
                查看项目
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">联系我</Link>
            </Button>
          </div>
        </section>
      </Reveal>

      {/* ---------- 精选项目 ---------- */}
      <section className="mt-20 grid gap-6">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">精选项目</h2>
            <Link
              to="/projects"
              className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              全部项目 →
            </Link>
          </div>
        </Reveal>

        <RevealList className="grid gap-4 sm:grid-cols-2">
          {featuredProjects.map((project) => (
            <RevealItem key={project.slug}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {project.role} · {formatPeriod(project.period)}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <TextWithPlaceholder
                    text={project.summary}
                    className="text-sm leading-relaxed text-slate-600 dark:text-slate-400"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {project.tech.map((tech) => (
                      <Badge key={tech} variant="outline">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealList>
      </section>

      {/* ---------- 能力概览 ---------- */}
      <section className="mt-20 grid gap-6">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">能力概览</h2>
        </Reveal>

        <RevealList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skillGroups.map((group) => (
            <RevealItem key={group.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealList>
      </section>

      {/* ---------- 教育背景 ---------- */}
      {education !== undefined ? (
        <Reveal className="mt-20">
          <section className="grid gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">教育背景</h2>

            <div className="grid gap-1">
              <p className="font-medium">{education.school}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {education.degree} · {education.major} · {formatPeriod(education.period)}
              </p>
              {education.rank !== null ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{education.rank}</p>
              ) : null}
            </div>

            {resume.awards.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {resume.awards.map((award) => (
                  <Badge key={award}>{award}</Badge>
                ))}
              </div>
            ) : null}
          </section>
        </Reveal>
      ) : null}
    </Container>
  );
}
