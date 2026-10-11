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

import { rehypeShikiVariablesToDataAttributes } from './src/lib/rehype-shiki-data-attributes.ts';

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
 */
const REPO_NAME = 'resume';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO_NAME}/` : '/',

  plugins: [mdxPlugin(), react(), tailwindcss(), contentGuard()],

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
        },
      },
    },
  },
}));
