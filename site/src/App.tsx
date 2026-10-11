/**
 * 阶段 1 的临时验证页：确认内容管道（PDF → JSON → Zod 校验 → 类型安全数据）已贯通。
 * 阶段 2 引入 React Router 后，这个文件会被替换成真正的路由表。
 */
import { featuredProjects, profile, resume, skillGroups } from '@/lib/content';

export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">
          {'{ stage: 1, status: "content pipeline OK" }'}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{profile.name}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{profile.headline}</p>
      </div>

      <section className="grid gap-3">
        <h2 className="font-mono text-sm text-slate-500">教育经历</h2>
        {resume.education.map((item) => (
          <div key={item.school} className="text-sm">
            <p className="font-medium">
              {item.school} · {item.major}
            </p>
            <p className="text-slate-500">
              {item.period.start} → {item.period.end ?? '至今'}
              {item.rank === null ? '' : ` · ${item.rank}`}
            </p>
            <p className="text-slate-500">主修课程 {item.courses.length} 门</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-mono text-sm text-slate-500">
          精选项目（共 {featuredProjects.length} 个）
        </h2>
        {featuredProjects.map((project) => (
          <div key={project.slug} className="text-sm">
            <p className="font-medium">
              {project.name} · {project.role}
            </p>
            <p className="text-slate-500">{project.tech.join(' / ')}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-mono text-sm text-slate-500">技能分组（共 {skillGroups.length} 组）</h2>
        <ul className="grid gap-1 text-sm text-slate-500">
          {skillGroups.map((group) => (
            <li key={group.id}>
              <span className="text-slate-700 dark:text-slate-300">{group.label}</span>：
              {group.items.join('、')}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
