import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { pageMeta } from '@/lib/content';
import { Seo } from '@/lib/seo/seo';

/**
 * 路由级错误边界。
 *
 * 挂在根路由上，任何子路由渲染或 loader 抛错都会被它接住，
 * 用户看到的是一个可操作的页面，而不是白屏 + 控制台报错。
 *
 * ## React Router 的错误对象有三种形态，必须分别处理
 *
 * 1. `isRouteErrorResponse` —— loader / action 主动 `throw` 的 Response；
 * 2. `Error` —— 组件渲染时抛出的普通异常；
 * 3. 其他（字符串等）—— 兜底。
 *
 * ## 一个重要修正：优先显示 body 而不是 statusText
 *
 * 第一版这里对 RouteErrorResponse 显示的是 `${status} ${statusText}`，
 * 于是一个拼错的项目 slug 会显示成「404 Not Found」——
 * **完全没用**：用户不知道是"项目不存在"还是"站点挂了"。
 *
 * 而 loader 抛出的 `new Response('找不到项目「xxx」', ...)` 里，
 * 那句中文消息在 **body**（`error.data`）里，`statusText` 只是 HTTP 状态短语。
 * 真实浏览器验证（Playwright）才暴露了这一点 ——
 * 单测与构建检查都发现不了"给用户看的文案拿错了字段"。
 */
export default function RouteErrorBoundary() {
  const error = useRouteError();

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const meta = isNotFound ? pageMeta.notFound : pageMeta.error;

  /** 展示给用户的细节：优先取 Response 的 body，它通常带更具体的信息 */
  const detail = (() => {
    if (isRouteErrorResponse(error)) {
      const data: unknown = error.data;
      if (typeof data === 'string' && data.trim() !== '') return data;
      // body 为空时退回状态短语，至少不是空白
      return `${String(error.status)} ${error.statusText}`;
    }
    if (error instanceof Error) return error.message;
    return pageMeta.error.description;
  })();

  return (
    <Container className="flex min-h-[60dvh] flex-col justify-center gap-4 py-16">
      {/* 错误页不该被搜索引擎收录 */}
      <Seo title={meta.title} description={meta.description} path="/error" indexable={false} />

      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">error</p>
      <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
      <p className="max-w-prose text-slate-600 dark:text-slate-400">{detail}</p>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => window.location.reload()}>重新加载</Button>
        {/* asChild 让 Link 直接获得按钮样式，最终 DOM 里只有一个 <a> */}
        <Button variant="outline" asChild>
          <Link to="/">回到首页</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/projects">浏览作品集</Link>
        </Button>
      </div>
    </Container>
  );
}
