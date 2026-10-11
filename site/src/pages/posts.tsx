import { useLoaderData } from 'react-router';

import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { PostCard } from '@/features/posts/post-card';
import type { postsListLoader } from '@/features/posts/post-loaders';
import { pageMeta } from '@/lib/content';
import { Seo } from '@/lib/seo/seo';

/**
 * 文章列表页。
 *
 * 草稿（frontmatter 里 draft: true）被 loader 过滤掉，不出现在列表里。
 * 这样"暂时隐藏一篇文章"不需要删除文件。
 */
export default function PostsPage() {
  const { posts, tags } = useLoaderData<typeof postsListLoader>();

  return (
    <Container className="py-16">
      <Seo title={pageMeta.posts.title} description={pageMeta.posts.description} path="/posts" />

      <Reveal>
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">posts</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">笔记与文章</h1>
        <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-400">
          {pageMeta.posts.description}
        </p>

        {tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">涉及主题</span>
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </Reveal>

      {posts.length > 0 ? (
        <RevealList className="mt-10 grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <RevealItem key={post.slug}>
              <PostCard post={post} />
            </RevealItem>
          ))}
        </RevealList>
      ) : (
        <p className="mt-10 text-slate-500 dark:text-slate-400">
          还没有文章。在 content/posts/ 下新增一个 .mdx 文件即可。
        </p>
      )}
    </Container>
  );
}
