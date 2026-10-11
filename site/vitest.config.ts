import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

/**
 * 测试配置。
 *
 * ## 为什么和 vite.config.ts 分开
 *
 * 复用生产配置会带来两个问题：
 * 1. **content-guard 插件会在测试启动时跑一遍内容校验** —— 那是构建期的事，
 *    测试里执行它既慢，报错信息也会和生产构建混在一起，难以定位；
 * 2. **MDX 插件与 React 插件在测试环境的解析顺序与生产不同**，
 *    没有必要为了跑单测去承担那份复杂度。
 *
 * 所以这里只配置测试真正需要的东西：路径别名、jsdom 环境、setup 文件。
 * 别名用 `vite-tsconfig-paths` 从 tsconfig 读取，保证与生产配置同源。
 */
export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    globals: true,
    environment: 'jsdom',

    // setup 文件在**每个测试文件**之前执行，用于注册匹配器、
    // 补浏览器 API 的 stub、启动 MSW（细节见 src/test/setup.ts）
    setupFiles: ['./src/test/setup.ts'],

    // 测试文件与被测代码同目录，后缀 .test.ts / .test.tsx
    include: ['src/**/*.test.{ts,tsx}'],

    // jsdom 计算样式很慢，而本项目的断言不依赖真实布局
    css: false,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],

      /**
       * ## 排除范围
       *
       * 每一项都有具体理由，目的不是让数字好看，而是让阈值只作用于
       * **真正由单测负责的代码**。把不该由单测负责的代码算进分母，
       * 只会逼人写没有价值的测试来凑数。
       *
       * 被排除的代码分三类，各自有更合适的验证方式：
       *
       * | 类别 | 例子 | 由谁验证 |
       * | --- | --- | --- |
       * | 构建期专用 | Zod schema、内容加载器、rehype 插件 | `pnpm validate` 等守卫脚本 |
       * | 布局组合 | 页面、站点外壳、设计系统基座 | Playwright E2E |
       * | 依赖浏览器 API | 主题 store、搜索面板、PDF 预览 | Playwright E2E |
       */
      exclude: [
        // ---- 无逻辑 ----
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/test/**',

        // ---- 构建期专用（Node 侧执行，不进浏览器产物）----
        // 正确性由真实内容上的守卫脚本验证，比单测更有说服力
        'src/lib/content/**',
        'src/lib/rehype-shiki-data-attributes.ts',

        // ---- 布局组合：由 E2E 覆盖 ----
        // 用单测断言"标题在左边还是右边"既脆弱又低价值
        'src/pages/**',
        'src/app/**',
        'src/components/layout/**',
        'src/components/page-placeholder.tsx',
        'src/components/text-with-placeholder.tsx',
        'src/components/ui/**',
        'src/features/posts/**',
        'src/features/projects/project-card.tsx',
        'src/features/projects/tag-filter.tsx',
        'src/features/projects/project-detail-loader.ts',

        // ---- 依赖真实浏览器 API：由 E2E 覆盖 ----
        // matchMedia / localStorage / IntersectionObserver 的真实行为，
        // 以及键盘导航与焦点管理，在 jsdom 里只能测到替身的行为
        'src/features/theme/**',
        'src/features/search/search-dialog.tsx',
        'src/features/search/search-launcher.tsx',
        'src/features/search/search-index.ts',
        'src/features/contact/contact-form.tsx',
        'src/features/resume/**',
        'src/features/github/lazy-github-repositories.tsx',
      ],

      thresholds: {
        // 这些阈值作用于**include 减去 exclude 之后**的代码，
        // 也就是确实由单测负责的那部分：
        // 筛选逻辑、GitHub 客户端与区块、表单校验、格式化、快捷键、Query 配置。
        // 既然范围清楚了，就可以要求得高一些。
        lines: 85,
        functions: 75,
        branches: 75,
        statements: 85,
      },
    },
  },
});
