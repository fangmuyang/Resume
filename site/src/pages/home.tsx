import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { featuredProjects, profile, skillGroups } from '@/lib/content';

/**
 * 首页。
 *
 * 阶段 2 只建立结构与响应式栅格，阶段 3 会在此基础上补：滚动入场动画、
 * 精选项目卡片交互、以及把技能分组做成更完整的展示。
 */
export default function HomePage() {
  return (
    <Container className="py-16">
      {/* ---------- Hero ---------- */}
      <section className="grid gap-6">
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">{profile.headline}</p>

        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {profile.name}
        </h1>

        <p className="max-w-prose leading-relaxed text-pretty text-slate-600 dark:text-slate-400">
          {profile.bio}
        </p>

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

      {/* ---------- 精选项目 ---------- */}
      <section className="mt-20 grid gap-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">精选项目</h2>
          <Link
            to="/projects"
            className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            全部项目 →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {featuredProjects.map((project) => (
            <Card key={project.slug}>
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {project.role} · {project.period.start.slice(0, 7)} 至{' '}
                  {project.period.end?.slice(0, 7) ?? '至今'}
                </p>
              </CardHeader>
              <CardContent className="grid gap-3">
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {project.summary}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {project.tech.map((tech) => (
                    <Badge key={tech} variant="outline">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- 技能概览 ---------- */}
      <section className="mt-20 grid gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">能力概览</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skillGroups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm text-slate-600 dark:text-slate-400">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </Container>
  );
}
