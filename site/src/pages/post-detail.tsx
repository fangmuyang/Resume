import { MDXProvider } from '@mdx-js/react';
import { ArrowLeft, Clock } from 'lucide-react';
import { Link, useLoaderData } from 'react-router';

import { Reveal } from '@/components/motion/reveal';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { Callout, TerminalSession } from '@/features/posts/mdx-components';
import type { PostDetailData } from '@/features/posts/post-loaders';
import { formatYearMonth } from '@/lib/format';

/**
 * 注入给 MDX 的自定义组件。
 *
 * 通过 MDXProvider 提供，所以每篇 .mdx 都能直接用 <Callout> / <TerminalSession>
 * 而不需要自己 import —— 这是 MDX 生态里让写作体验干净的关键机制。
 */
const MDX_COMPONENTS = {
  Callout,
  TerminalSession,
} as const;

/**
 * 文章详情页。
 *
 * 正文用 `prose` 风格的排版：MDX 编译出的元素是原生 HTML（h2/p/ul/pre…），
 * 没有类名可挂，所以用后代选择器统一设置排版样式，
 * 而不是给每个元素写组件 —— 后者会让 markdown 的可读性丧失殆尽。
 */
export default function PostDetailPage() {
  /**
   * 显式标注返回类型，而不是靠 useLoaderData<typeof loader> 推导。
   *
   * 实测下来 React Router 在此版本处理「loader 数据里含 React 元素」的结构时
   * 会推断失败（依次得到 never、以及缺少 children 的 ReactElement）。
   * loader 自身的返回类型是正确的，退化发生在 hook 的类型变换里。
   * 显式标注既让页面类型稳定，也把 loader 的契约写在唯一的使用点上。
   */
  const { meta, content, prev, next } = useLoaderData() as PostDetailData;

  return (
    <Container className="py-16">
      <Reveal>
        <Link
          to="/posts"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="size-4" />
          返回文章列表
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {meta.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
          <time dateTime={meta.date} className="font-mono">
            {formatYearMonth(meta.date)}
          </time>
          {meta.updated !== null ? (
            <span className="font-mono">更新于 {formatYearMonth(meta.updated)}</span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />约 {meta.readingMinutes} 分钟
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {meta.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </Reveal>

      <article className="mt-10">
        <MDXProvider components={MDX_COMPONENTS}>
          <div className="[&_a]:text-brand-600 dark:[&_a]:text-brand-500 grid gap-4 [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-500 dark:[&_blockquote]:border-slate-700 [&_blockquote]:dark:text-slate-400 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] dark:[&_code]:bg-slate-800 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:leading-relaxed [&_p]:text-slate-700 dark:[&_p]:text-slate-300 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-slate-200 [&_pre]:p-4 [&_pre]:text-sm dark:[&_pre]:border-slate-800 [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm dark:[&_td]:border-slate-800 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm dark:[&_th]:border-slate-800 dark:[&_th]:bg-slate-900 [&_ul]:list-disc [&_ul]:pl-6">
            {content}
          </div>
        </MDXProvider>
      </article>

      {prev !== null || next !== null ? (
        <Reveal className="mt-16">
          <nav
            aria-label="文章导航"
            className="grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2 dark:border-slate-800"
          >
            {prev !== null ? (
              <Link
                to={prev.slug}
                relative="path"
                className="hover:border-brand-500 grid gap-1 rounded-lg border border-slate-200 p-4 transition-colors dark:border-slate-800"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400">上一篇</span>
                <span className="text-sm font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}

            {next !== null ? (
              <Link
                to={next.slug}
                relative="path"
                className="hover:border-brand-500 grid gap-1 rounded-lg border border-slate-200 p-4 transition-colors sm:text-right dark:border-slate-800"
              >
                <span className="text-xs text-slate-500 dark:text-slate-400">下一篇</span>
                <span className="text-sm font-medium">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </Reveal>
      ) : null}
    </Container>
  );
}
