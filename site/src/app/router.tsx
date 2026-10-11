import { createBrowserRouter, type RouteObject } from 'react-router';

import RootLayout from '@/app/root-layout';
import RouteErrorBoundary from '@/app/route-error-boundary';
import { projectDetailLoader } from '@/features/projects/project-detail-loader';

/**
 * 路由表。
 *
 * 三个关键决策：
 *
 * 1. **basename 必须与 Vite 的 base 一致。**
 *    import.meta.env.BASE_URL 由 vite.config.ts 的 base 派生 ——
 *    开发时是 '/'，生产构建是 '/resume/'。
 *    两边共用同一个来源，就不会出现"改了 base 忘了改 basename"导致
 *    线上所有路由都匹配失败的问题。
 *
 * 2. **所有页面都用 lazy 懒加载。**
 *    每个页面被拆成独立 chunk，首屏只下载当前路由需要的代码。
 *    代价是一次导航可能触发一次网络请求，对内容站完全值得。
 *    注意：组件必须是默认导出，lazy 才能正确取到。
 *
 * 3. **错误边界挂在根路由上**，任何子页面渲染出错都被它接住，
 *    用户看到可操作的错误页而不是白屏。
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { default: Component } = await import('@/pages/home');
          return { Component };
        },
      },
      {
        path: 'about',
        lazy: async () => {
          const { default: Component } = await import('@/pages/about');
          return { Component };
        },
      },
      {
        path: 'projects',
        lazy: async () => {
          const { default: Component } = await import('@/pages/projects');
          return { Component };
        },
      },
      {
        /**
         * 详情页带 loader：数据在渲染前就绪，组件里不需要处理"可能没有项目"的分支。
         * 找不到 slug 时 loader 抛 404 Response，由根路由的错误边界渲染成错误页。
         *
         * loader 用**静态导入**（文件顶部）而不是在 loader 内部 await import：
         * 后者会让 Vite 把 loader 单独拆成一个 chunk，同一个路由因此出现两个产物文件；
         * 而且 loader 必须在渲染前可用，动态加载它只会推迟首屏。
         */
        path: 'projects/:slug',
        loader: projectDetailLoader,
        lazy: async () => {
          const { default: Component } = await import('@/pages/project-detail');
          return { Component };
        },
      },
      {
        path: 'posts',
        lazy: async () => {
          const { default: Component } = await import('@/pages/posts');
          return { Component };
        },
      },
      {
        path: 'resume',
        lazy: async () => {
          const { default: Component } = await import('@/pages/resume');
          return { Component };
        },
      },
      {
        path: 'contact',
        lazy: async () => {
          const { default: Component } = await import('@/pages/contact');
          return { Component };
        },
      },
      {
        // 兜底：未匹配的地址渲染 404，而不是让错误边界去猜
        path: '*',
        lazy: async () => {
          const { default: Component } = await import('@/pages/not-found');
          return { Component };
        },
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { basename });
