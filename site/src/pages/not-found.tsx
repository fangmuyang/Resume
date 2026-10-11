import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export default function NotFoundPage() {
  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-16">
      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">404</p>
      <h1 className="text-3xl font-bold tracking-tight">页面不存在</h1>
      <p className="max-w-prose text-slate-600 dark:text-slate-400">
        你访问的地址没有对应的页面。可能是链接过期，或者地址拼写有误。
      </p>

      <div>
        <Button asChild>
          <Link to="/">回到首页</Link>
        </Button>
      </div>
    </Container>
  );
}
