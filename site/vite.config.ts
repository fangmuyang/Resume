import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * The repository is one level above the Vite project root.
 * import.meta.url points at this config file, so ../ means the repo root.
 */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

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
      const { CONTENT_FILES, PROJECTS_DIR, validateAllContent } =
        await import('./src/lib/content/validate.ts');

      const contentRoot = join(repoRoot, 'content');
      const projectsDir = join(contentRoot, PROJECTS_DIR);

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

      try {
        const { projects } = validateAllContent(readJson, projectPaths);
        this.info(
          `内容校验通过：${projects.length} 个项目、${projectPaths.length} 个作品集文件。` +
            `（入口文件：${Object.values(CONTENT_FILES).join(', ')}）`,
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

  plugins: [react(), tailwindcss(), contentGuard()],

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
  },
}));
