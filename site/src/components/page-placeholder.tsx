import { Container } from '@/components/ui/container';

/**
 * 尚未实现的页面占位。
 *
 * 刻意做成一个显式组件而不是空白页面：空白页会让人以为出了 bug，
 * 而把"这个页面属于哪个阶段"写在页面上，路由骨架就同时是一份进度看板。
 */
export interface PagePlaceholderProps {
  title: string;
  description: string;
  /** 由哪个阶段实现 */
  stage: string;
  /** 该页面计划包含的要点 */
  bullets: readonly string[];
}

export function PagePlaceholder({ title, description, stage, bullets }: PagePlaceholderProps) {
  return (
    <Container className="py-16">
      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">{stage}</p>

      <h1 className="mt-3 text-4xl font-bold tracking-tight">{title}</h1>

      <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>

      <ul className="mt-8 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
        {bullets.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-slate-400 dark:text-slate-600">
              —
            </span>
            {item}
          </li>
        ))}
      </ul>
    </Container>
  );
}
