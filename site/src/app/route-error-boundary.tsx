import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

/**
 * 路由级错误边界。
 *
 * 挂在根路由上，任何子路由渲染时抛错都会被它接住，
 * 用户看到的是一个可操作的页面，而不是白屏 + 控制台报错。
 *
 * React Router 的错误对象有三种形态，必须分别处理：
 * 1. isRouteErrorResponse —— loader / action 主动 throw 的 Response（如 404）；
 * 2. Error —— 组件渲染时抛出的普通异常；
 * 3. 其他（字符串等）—— 兜底。
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();

  const title = isRouteErrorResponse(error) && error.status === 404 ? '页面不存在' : '出错了';

  const detail = (() => {
    if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
    if (error instanceof Error) return error.message;
    return '发生了未知错误';
  })();

  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-16">
      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">error</p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-prose text-slate-600 dark:text-slate-400">{detail}</p>

      <div className="flex gap-3">
        <Button onClick={() => window.location.reload()}>重新加载</Button>
        {/* asChild 让 Link 直接获得按钮样式，最终 DOM 里只有一个 <a> */}
        <Button variant="outline" asChild>
          <Link to="/">回到首页</Link>
        </Button>
      </div>
    </Container>
  );
}
