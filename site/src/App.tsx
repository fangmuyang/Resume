/**
 * 阶段 0 的临时首页，用来验证工具链是否全部打通。
 * 阶段 2 引入 React Router 后，这个文件会被替换成真正的路由表。
 */
export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">
        {'{ stage: 0, status: "toolchain OK" }'}
      </p>

      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        方睿杰 · 个人网站
      </h1>

      <p className="max-w-prose leading-relaxed text-pretty text-slate-600 dark:text-slate-400">
        工程骨架已就绪。接下来的阶段会依次接入内容管道、路由与布局、暗黑模式、作品集、MDX
        笔记、搜索与部署流水线。
      </p>

      <ul className="grid gap-2 font-mono text-sm text-slate-500 dark:text-slate-500">
        <li>✓ React 19 + TypeScript（strict 全开）</li>
        <li>✓ Vite 7 构建与开发服务器</li>
        <li>✓ Tailwind CSS v4</li>
        <li>✓ ESLint 9 + Prettier</li>
      </ul>
    </main>
  );
}
