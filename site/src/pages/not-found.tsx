import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { pageMeta } from '@/lib/content';
import { Seo } from '@/lib/seo/seo';

export default function NotFoundPage() {
  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-16">
      {/*
        404 页面设 noindex。
        不这么做的话，任何一个失效外链都会在搜索结果里留下一条"页面不存在"。
      */}
      <Seo
        title={pageMeta.notFound.title}
        description={pageMeta.notFound.description}
        path="/404"
        indexable={false}
      />

      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">404</p>
      <h1 className="text-3xl font-bold tracking-tight">{pageMeta.notFound.title}</h1>
      <p className="max-w-prose text-slate-600 dark:text-slate-400">
        {pageMeta.notFound.description}
      </p>

      <div>
        <Button asChild>
          <Link to="/">回到首页</Link>
        </Button>
      </div>
    </Container>
  );
}
