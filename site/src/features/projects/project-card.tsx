import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';

import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Project } from '@/lib/content';
import { formatPeriod } from '@/lib/format';
import { resolveAssetUrl } from '@/lib/projects';
import { cn } from '@/lib/utils';

/** 项目状态对应的展示文案与配色 */
const STATUS_META: Record<Project['status'], { label: string; className: string }> = {
  active: {
    label: '进行中',
    className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  },
  completed: { label: '已完成', className: 'border-slate-300 text-slate-600 dark:text-slate-400' },
  archived: { label: '已归档', className: 'border-slate-300 text-slate-500 dark:text-slate-500' },
};

export interface ProjectCardProps {
  project: Project;
  /**
   * 点击标签时的回调。
   * 传 undefined 时标签渲染成静态徽章 —— 详情页不需要"筛选"这个动作。
   */
  onTagClick?: (tag: string) => void;
  /** 当前已被选中的标签，用于高亮 */
  selectedTags?: readonly string[];
  className?: string;
}

export function ProjectCard({
  project,
  onTagClick,
  selectedTags = [],
  className,
}: ProjectCardProps) {
  const cover = resolveAssetUrl(project.cover);
  const status = STATUS_META[project.status];

  return (
    <Card className={cn('group flex h-full flex-col overflow-hidden', className)}>
      {/* 没有配图时整块不渲染，卡片自然退化为纯文字版式 */}
      {cover !== null ? (
        <div className="aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={cover}
            alt={`${project.name} 界面截图`}
            // 列表里的图片几乎都在首屏之下，默认懒加载能省掉大量带宽
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : null}

      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>
            {/*
              to 用相对路径 + relative="path"：
              这样同一个组件在列表页（/projects）渲染时链接到 /projects/:slug，
              在详情页的「相关项目」区域渲染时也能正确解析，不需要传不同参数。
            */}
            <Link
              to={project.slug}
              relative="path"
              className="hover:text-brand-600 dark:hover:text-brand-500 transition-colors"
            >
              {project.name}
            </Link>
          </CardTitle>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          {project.role} · {formatPeriod(project.period)}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <TextWithPlaceholder
          text={project.summary}
          className="text-sm leading-relaxed text-slate-600 dark:text-slate-400"
        />

        <div className="mt-auto flex flex-wrap gap-1.5">
          {[...project.tech, ...project.tags].map((tag) =>
            onTagClick === undefined ? (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ) : (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                aria-pressed={selectedTags.includes(tag)}
                className="focus-visible:ring-brand-500 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <Badge
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="hover:border-brand-500 transition-colors"
                >
                  {tag}
                </Badge>
              </button>
            ),
          )}
        </div>

        <Link
          to={project.slug}
          relative="path"
          className="text-brand-600 dark:text-brand-500 inline-flex items-center gap-1 text-sm hover:underline"
        >
          查看详情
          <ArrowUpRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
