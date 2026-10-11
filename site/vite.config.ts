import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { rehypeShikiVariablesToDataAttributes } from './src/lib/rehype-shiki-data-attributes.ts';
import { REPO_NAME } from './src/lib/seo/site-config.ts';

/**
 * MDX 配置。
 *
 * 插件顺序有讲究：
 * 1. `enforce: 'pre'` 让 MDX 先于 React 插件处理 .mdx 文件，
 *    否则 React 插件会先看到它并抱怨不认识这个扩展名里的 JSX；
 * 2. rehype 插件**按数组顺序执行**，所以 shiki 变量搬运器必须排在
 *    rehype-pretty-code **之后** —— 它得等颜色写进 style 之后再处理。
 *
 * remarkFrontmatter 负责识别文件顶部的 YAML 区块（不解析成数据，
 * 解析与校验在构建期的 validate-content 里做，见 lib/content/post-frontmatter.ts）。
 */
function mdxPlugin(): Plugin {
  return {
    ...mdx({
      remarkPlugins: [remarkFrontmatter, remarkGfm],
      rehypePlugins: [
        [
          rehypePrettyCode,
          {
            // 双主题：亮色用 github-light，暗色用 github-dark。
            // 颜色通过 data 属性 + CSS 与站点的 .dark 类联动；
            // 内联 style 会被下一个插件搬走（原因见那个文件的顶部说明）。
            theme: { light: 'github-light', dark: 'github-dark' },
            keepBackground: false,
          },
        ],
        rehypeShikiVariablesToDataAttributes,
      ],
      // 让 MDX 内部可以直接使用我们提供的组件，而不必每篇都 import
      providerImportSource: '@mdx-js/react',
    }),
    enforce: 'pre',
  };
}

/**
 * Content lives inside the Vite project root: `site/content/`.
 *
 * It used to sit at the repository root. Moving it here was not cosmetic —
 * pnpm's strict isolation means `react` is only resolvable from
 * `site/node_modules`. MDX compiles to code that imports `react/jsx-runtime`,
 * so a .mdx file outside the package root fails with
 * "Rollup failed to resolve import react/jsx-runtime".
 */
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Content guard plugin.
 *
 * Why this exists (a real trap worth remembering):
 * a top-level `throw` inside an app module does NOT fail a Vite build.
 * Vite only *bundles* modules statically — their bodies never run in Node,
 * so schema validation placed in a module only fires in the browser, i.e.
 * after the broken content is already deployed as a blank page.
 *
 * Running the same Zod validation inside a Vite hook executes it in Node
 * where a thrown error actually aborts the build.
 */
function contentGuard(): Plugin {
  return {
    name: 'content-guard',

    async buildStart() {
      // Imported lazily so the (TypeScript) schema files are only loaded when
      // the plugin actually runs. Node 22.18+/24 can import .ts directly.
      const { POSTS_DIR, PROJECTS_DIR, validateAllContent, validatePost } =
        await import('./src/lib/content/validate.ts');

      const contentRoot = join(projectRoot, 'content');
      const projectsDir = join(contentRoot, PROJECTS_DIR);
      const postsDir = join(contentRoot, POSTS_DIR);

      const readJson = (relativePath: string): unknown => {
        const raw = readFileSync(join(contentRoot, relativePath), 'utf8');
        try {
          return JSON.parse(raw) as unknown;
        } catch (error) {
          throw new Error(`content/${relativePath} 不是合法的 JSON：${(error as Error).message}`);
        }
      };

      let projectPaths: string[];
      try {
        projectPaths = readdirSync(projectsDir)
          .filter((name) => name.endsWith('.json'))
          .map((name) => `${PROJECTS_DIR}/${name}`)
          .sort();
      } catch {
        this.error(`找不到内容目录 content/${PROJECTS_DIR}。请先运行 \`pnpm extract\` 生成内容。`);
        return;
      }

      // 文章目录允许不存在（还没有文章是合法状态），所以不报错，只跳过
      const postFiles = (() => {
        try {
          return readdirSync(postsDir).filter((name) => name.endsWith('.mdx'));
        } catch {
          return [];
        }
      })();

      try {
        const { projects } = validateAllContent(readJson, projectPaths);

        // 文章 frontmatter 在这里校验：MDX 正文由 @mdx-js/rollup 编译，
        // 但元数据的正确性必须在构建期确定（见 lib/content/schema/post.ts 的说明）
        const posts = postFiles.map((fileName) => {
          const slug = fileName.replace(/\.mdx$/, '');
          const source = readFileSync(join(postsDir, fileName), 'utf8');
          return validatePost(source, slug, `content/${POSTS_DIR}/${fileName}`);
        });

        this.info(
          `内容校验通过：${projects.length} 个项目、${projectPaths.length} 个作品集文件、` +
            `${posts.length} 篇文章。`,
        );
      } catch (error) {
        // this.error 会中断构建并带上文件名与字段路径
        this.error((error as Error).message);
      }
    },
  };
}

/**
 * base decides the URL prefix of every emitted asset.
 * A GitHub Pages *project* site is served from https://<user>.github.io/<repo>/,
 * so the production build must use '/resume/'. Getting this wrong produces the
 * classic "blank page + 404 on every asset" symptom.
 * Local dev is happier at '/', hence the split by command.
 *
 * REPO_NAME is imported from src/lib/seo/site-config.ts so that canonical
 * links, the sitemap and the PWA manifest cannot drift out of sync with base.
 */

/**
 * PWA 配置。
 *
 * ## 为什么值得做
 *
 * 三件具体的好处，不是为了"有 PWA 这个标签"：
 * 1. **可安装** —— 移动端可以加到主屏，有自己的图标与启动画面；
 * 2. **离线可用** —— 已经访问过的页面在断网时仍能打开；
 * 3. **二次访问更快** —— 静态资源从 Cache Storage 读取，不走网络。
 *
 * ## precache 的白名单思路
 *
 * Workbox 默认会把 `dist` 下所有产物都加进 precache 清单。
 * 对本项目来说这**不合适**：`pdf-*.js` 有 437 KB、
 * 三篇文章的 MDX chunk 加起来约 66 KB —— 把它们塞进"首次访问就必须下载完"
 * 的清单，等于把安装体积翻倍，而多数访客根本不会打开简历预览。
 *
 * 所以 `globPatterns` 只收 HTML、图标与 manifest，
 * JS/CSS 交给下面的 `runtimeCaching` 按需缓存：
 * 访问过的页面会被缓存，没访问过的不会白白下载。
 *
 * ## `navigateFallback` 与部署的关系
 *
 * SPA 的深层路由（如 `/resume/posts/xxx`）在服务器上并没有对应文件。
 * Workbox 的 navigateFallback 会把这类导航请求重写到 index.html，
 * 让前端路由接管 —— 这正好与阶段 11 要在 GitHub Pages 上做的 404 回退
 * 是同一个问题的两个层面（离线侧 vs 在线侧）。
 */
/**
 * PWA manifest 的文案从内容读取，而不是写在这里。
 *
 * 这是"零硬编码"约定的延伸：站点名、描述、主题色都是**内容事实**，
 * 会在内容文件里调整（甚至可能由非开发者调整）。
 * 写在构建配置里会让它们脱离内容管道，也会被零硬编码守卫视为散落的文案。
 *
 * 注意读的是 `profile-public.json`（构建期生成的脱敏副本），
 * 不是源头 `profile.json` —— 构建配置也没有理由接触私密字段。
 */
function readSeoProfile(): {
  name: string;
  siteName: string;
  shortName: string;
  description: string;
  language: string;
  direction: 'ltr' | 'rtl';
  themeColor: string;
} {
  const raw = readFileSync(join(projectRoot, 'content', 'profile-public.json'), 'utf8');
  const parsed = JSON.parse(raw) as {
    name?: unknown;
    seo?: Record<string, unknown>;
  };
  const seo = parsed.seo ?? {};

  const readString = (key: string, fallback: string): string =>
    typeof seo[key] === 'string' && seo[key] !== '' ? (seo[key] as string) : fallback;

  const name = typeof parsed.name === 'string' ? parsed.name : '';

  return {
    name,
    siteName: readString('siteName', '个人网站'),
    shortName: readString('shortName', name === '' ? '个人网站' : name),
    description: readString('defaultDescription', ''),
    language: readString('language', 'zh-CN'),
    direction: readString('direction', 'ltr') === 'rtl' ? 'rtl' : 'ltr',
    themeColor: readString('themeColor', '#4f46e5'),
  };
}

function pwaPlugin(): Plugin[] {
  const seo = readSeoProfile();

  return VitePWA({
    /**
     * `autoUpdate` 而不是 `prompt`。
     *
     * `prompt` 需要自己实现"有新版本，是否刷新？"的 UI ——
     * 对一个内容型个人站点来说，多一个弹窗的打扰大于收益。
     * 代价是用户可能在打开着旧版本时被静默更新，
     * 但对这种无状态站点来说没有副作用。
     */
    registerType: 'autoUpdate',

    // 注册逻辑由插件注入，不需要手写 service worker 注册代码
    injectRegister: 'auto',

    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt'],

    manifest: {
      // manifest 里的 name 用「姓名 · 站点名」组合，便于区分同名站点
      name: seo.name === '' ? seo.siteName : `${seo.name} · ${seo.siteName}`,
      short_name: seo.shortName,
      description: seo.description,
      lang: seo.language,
      dir: seo.direction,
      start_url: `/${REPO_NAME}/`,
      scope: `/${REPO_NAME}/`,
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: seo.themeColor,
      background_color: seo.themeColor,
      categories: ['portfolio', 'education', 'developer'],
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          // purpose 必须显式声明，否则 Android 会把普通图标当 maskable 裁切
          purpose: 'maskable',
        },
      ],
    },

    workbox: {
      // 只预缓存"任何访客都会用到"的轻量资源
      globPatterns: ['**/*.{html,ico,png,svg,webmanifest}'],

      // 单文件上限 2 MB；构建产物里没有超过这个大小的静态资源
      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,

      // 清理旧版本遗留的缓存，避免存储无限增长
      cleanupOutdatedCaches: true,

      // 深层路由回退到 index.html，让前端路由接管
      navigateFallback: `/${REPO_NAME}/index.html`,
      // 静态资源与 robots/sitemap 不该被当作导航请求处理
      navigateFallbackDenylist: [/^\/resume\/assets\//, /robots\.txt$/, /sitemap\.xml$/],

      runtimeCaching: [
        {
          /**
           * 构建产物按需缓存（CacheFirst）。
           *
           * 文件名带内容 hash，所以同一个 URL 的内容永不变 ——
           * 这正是 CacheFirst 成立的前提，也是 Vite 输出带 hash 文件名的价值之一。
           */
          urlPattern: /\/resume\/assets\/.*\.(?:js|css|woff2?)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-assets',
            expiration: {
              // 上限 80 条：一次完整浏览会经过约 20 个 chunk，
              // 给几次版本更新留出余量
              maxEntries: 80,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          /**
           * 简历 PDF 单独一个缓存（StaleWhileRevalidate）。
           *
           * 它约 1.8 MB，不进 precache（多数访客不会下载）。
           * 但一旦下载过，第二次打开应该立刻可用 —— 所以用 SWR：
           * 先用缓存渲染，同时后台检查更新。
           */
          urlPattern: /\/resume\/resume\.pdf$/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'resume-pdf',
            expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          /**
           * GitHub API 用 NetworkFirst。
           *
           * 这份数据必须尽量新（仓库列表会变），所以优先走网络；
           * 网络失败时用最近一次成功的结果兜底。
           * 注意：**不能用 CacheFirst** —— 那会让用户长期看到过期的仓库列表。
           */
          urlPattern: /^https:\/\/api\.github\.com\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'github-api',
            networkTimeoutSeconds: 5,
            expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },

    devOptions: {
      // 开发环境不启用 service worker：否则改代码后看到的是缓存版本，
      // 会让"改动没生效"这种问题浪费大量时间
      enabled: false,
    },
  }) as Plugin[];
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO_NAME}/` : '/',

  plugins: [mdxPlugin(), react(), tailwindcss(), contentGuard(), ...pwaPlugin()],

  resolve: {
    alias: {
      // Must stay in sync with compilerOptions.paths in tsconfig.json
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    strictPort: false,
  },

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,

    /**
     * 不预加载按需使用的 vendor chunk。
     *
     * Vite 默认会为入口能间接到达的所有 chunk 注入 `<link rel="modulepreload">`，
     * 包括那些只在懒加载分支里用到的。实测 `vendor-query`（TanStack Query，
     * 只有「开源仓库」区块需要）也被写进了 index.html 的 modulepreload ——
     * 等于首屏就把它下载了，把懒加载的意义抵消掉。
     *
     * 这里把纯按需的 vendor chunk 排除。保留 vendor-react / vendor-router 是
     * 因为它们确实在首屏关键路径上，预加载能减少瀑布式请求。
     */
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('vendor-query') && !dep.includes('vendor-motion')),
    },

    rollupOptions: {
      output: {
        /**
         * Split third-party code into stable, separately cacheable chunks.
         *
         * Two reasons:
         * 1. Diagnosis — a single 490 KB chunk tells you nothing about where the
         *    bytes went. Split vendor chunks make each library's cost visible.
         * 2. Caching — when only app code changes, browsers keep the vendor chunks
         *    and re-download just the small app chunk.
         *
         * Note: manualChunks is a blunt instrument. It does not tree-shake anything,
         * it only relocates modules between output files. Real size reductions come
         * from not importing the code in the first place.
         */
        manualChunks: {
          // Must list every entry point, not just the package name.
          // 'react' alone leaves 'react-dom/client' and 'react/jsx-runtime'
          // out of the rule, and they silently land in the main chunk instead.
          'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
          'vendor-router': ['react-router'],
          'vendor-motion': ['motion'],
          'vendor-state': ['zustand'],
          // TanStack Query 只被「GitHub 仓库列表」用到。
          // 单独拆出来可以把它移出其他页面的关键路径 ——
          // 实测主 chunk 因此从 205 KB 回落到约 94 KB。
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
}));
