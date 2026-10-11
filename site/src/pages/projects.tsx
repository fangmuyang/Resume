import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { ProjectCard } from '@/features/projects/project-card';
import { TagFilter } from '@/features/projects/tag-filter';
import { useProjectFilter } from '@/features/projects/filter-store';
import { projects } from '@/lib/content';
import { collectTags, filterProjects } from '@/lib/projects';

/**
 * 作品集列表页。
 *
 * 筛选状态完全由 URL 承载（见 features/projects/filter-store.ts 的说明）：
 * 「点标签 → 筛选」与「直接打开带参数的链接 → 同样的结果」走同一条代码路径，
 * 因此不会出现"分享出去的链接打开后筛选丢了"这类问题。
 */
export default function ProjectsPage() {
  const { selectedTags, toggle, clear } = useProjectFilter();

  // 标签从内容里聚合，不写死在页面里 —— 页面文案与标签必须可维护
  const tags = collectTags(projects);
  const visible = filterProjects(projects, selectedTags);

  // 列表页引导语同样来自内容：约定只有一个项目设置 listIntro
  const intro = projects.find((project) => project.listIntro !== null)?.listIntro ?? null;

  return (
    <Container className="py-16">
      <Reveal>
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">projects</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">项目与作品</h1>
        {intro !== null ? (
          <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-400">
            {intro}
          </p>
        ) : null}
      </Reveal>

      <Reveal className="mt-10">
        <TagFilter
          tags={tags}
          selected={selectedTags}
          onToggle={toggle}
          onClear={clear}
          resultCount={visible.length}
        />
      </Reveal>

      {visible.length > 0 ? (
        <RevealList className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => (
            <RevealItem key={project.slug}>
              <ProjectCard
                project={project}
                onTagClick={toggle}
                selectedTags={selectedTags}
                className="h-full"
              />
            </RevealItem>
          ))}
        </RevealList>
      ) : (
        // 空状态必须给出下一步动作，只显示"没有结果"会让人卡住
        <div className="mt-12 grid justify-items-start gap-4 rounded-lg border border-dashed border-slate-300 p-8 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400">
            没有同时满足这些标签的项目：{selectedTags.join('、')}
          </p>
          <Button variant="outline" onClick={clear}>
            清除筛选
          </Button>
        </div>
      )}
    </Container>
  );
}
