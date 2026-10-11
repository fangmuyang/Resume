# 方睿杰 · 个人网站

[![CI](https://github.com/fangmuyang/resume/actions/workflows/ci.yml/badge.svg)](https://github.com/fangmuyang/resume/actions/workflows/ci.yml)
[![Deploy](https://github.com/fangmuyang/resume/actions/workflows/deploy.yml/badge.svg)](https://github.com/fangmuyang/resume/actions/workflows/deploy.yml)

用 React 19 + TypeScript 从零构建的个人网站，内容源自一份 PDF 简历。这个仓库同时是一份
**可运行的学习范本**：每一层技术选型都对应一个真实需求，并在 `docs/` 里配有说明。

- 站点地址：https://fangmuyang.github.io/resume/
- 内容来源：`MyResume.pdf`
- **技术学习文档：[`docs/LEARNING.md`](docs/LEARNING.md)** —— 9 章，讲清每层为什么这么写
- 阶段路线图：[`docs/ROADMAP.md`](docs/ROADMAP.md)
- 部署与自定义域名：[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

---

## 技术栈

| 层次 | 选型                             | 在本项目中的作用                                    |
| ---- | -------------------------------- | --------------------------------------------------- |
| 核心 | React 19 · TypeScript 5.9        | 组件与类型系统                                      |
| 构建 | Vite 7                           | 开发服务器、生产构建与 vendor 分包                  |
| 路由 | React Router 7（数据路由）       | 九个路由、懒加载、路由级错误边界、loader 预取       |
| 状态 | Zustand 5                        | 主题状态（暗黑模式）                                |
| 动画 | Motion（Framer Motion）          | 路由切换过渡，尊重 prefers-reduced-motion           |
| 样式 | Tailwind CSS v4 · cva · clsx     | 设计令牌、变体与类名合并                            |
| 图标 | lucide-react                     | 图标（按需 tree-shaking）                           |
| 内容 | Zod 4（仅构建期）· pdfjs-dist    | 内容校验与 PDF 提取，均不进入浏览器产物             |
| 文章 | MDX 3 · rehype-pretty-code       | Markdown 里嵌入 React 组件，双主题代码高亮          |
| 搜索 | Fuse.js 7                        | 项目/文章/技能统一索引，懒加载面板                  |
| 表单 | React Hook Form 7 · Zod 4        | 联系表单的校验与状态机                              |
| 数据 | TanStack Query 5 · MSW 2         | GitHub API 的缓存与重试；测试中在网络层 mock        |
| 测试 | Vitest 3 · RTL · Playwright      | 单测 91 个；E2E 142 个（桌面 + 移动端，跑生产产物） |
| 质量 | ESLint 9 · Prettier 3            | 静态检查与格式化                                    |
| 提交 | Husky · lint-staged · commitlint | 本地提交卡口 + 提交信息规范                         |
| 部署 | PWA · sitemap · JSON-LD          | 子路径部署、可安装、离线浏览已访问页面              |

工程侧还有六个构建后守卫脚本（见「常用命令」），
它们把「约定」变成可执行的检查，而不是靠人自觉：

| 守卫             | 防止什么                                       |
| ---------------- | ---------------------------------------------- |
| `verify:build`   | 子路径前缀丢失、路由分块缺失、动态导入路径写错 |
| `verify:privacy` | 私密字段（手机号）泄漏进产物                   |
| `verify:content` | 页面文案硬编码在组件里，脱离内容管道           |
| `verify:search`  | 搜索索引漏页、跳转目标无效                     |
| `verify:seo`     | sitemap 缺页、manifest 的 scope 与 base 不一致 |
| `validate`       | 内容不符合 schema、占位符未清理                |

CI 与部署见 [`.github/workflows/`](.github/workflows/)；自定义域名与排查清单见
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)。

## 目录结构

```
.
├── MyResume.pdf          # 内容来源（唯一真相来源）
├── docs/
│   └── ROADMAP.md        # 阶段路线图与技术决策记录
├── site/                 # 业务工程（React + TS + Vite）
│   ├── content/          # 内容与代码分离：站点内容（在项目内，见下方说明）
│   │   ├── profile.json      # 个人信息、联系方式、隐私开关
│   │   ├── resume.json       # 教育经历、项目概览、奖项
│   │   ├── skills.json       # 技能分组
│   │   ├── projects/*.json   # 作品集详情（文件名即 slug）
│   │   ├── posts/*.mdx       # 文章正文（MDX）
│   │   ├── posts-index.json  # 构建期生成的文章元数据索引
│   │   └── raw/              # PDF 原始文本行，便于核对与 diff
│   ├── scripts/
│   │   ├── extract-pdf.ts        # PDF → content/ 的可复现管道
│   │   ├── build-posts-index.ts  # 扫描 MDX frontmatter 生成文章索引
│   │   ├── validate-content.ts   # 内容校验 CLI
│   │   ├── verify-content-usage.ts # 零硬编码检查
│   │   └── verify-build.ts       # 产物验证（base 前缀、basename、分块、防 FOUC）
│   ├── src/
│   │   ├── app/          # 站点外壳：路由表、根布局、错误边界、页面过渡
│   │   ├── pages/        # 按路由切分的页面组件（懒加载）
│   │   ├── features/     # 垂直切片：theme / projects / posts
│   │   ├── components/
│   │   │   ├── ui/       # 设计系统基座：Button / Card / Badge / Container / Slot
│   │   │   ├── layout/   # Header / Footer / 移动端抽屉
│   │   │   └── motion/   # 滚动入场动画
│   │   ├── lib/
│   │   │   ├── content/  # Zod schema、校验逻辑、类型安全加载器
│   │   │   ├── projects.ts / format.ts / motion.ts / navigation.ts / utils.ts
│   │   │   └── rehype-shiki-data-attributes.ts  # 修 MDX 与 shiki 的兼容问题
│   │   ├── main.tsx      # 应用入口
│   │   └── styles/index.css    # Tailwind v4 入口 + 设计令牌 + 代码高亮主题
│   ├── eslint.config.js  # ESLint 9 扁平配置
│   ├── tsconfig.json     # 严格模式全开
│   └── vite.config.ts    # 内容校验插件 + MDX 配置 + vendor 分包
├── .github/workflows/    # CI（校验 + E2E）与 GitHub Pages 部署
├── .husky/               # Git 提交钩子
├── lint-staged.config.js
└── commitlint.config.js
```

> **为什么 `content/` 在 `site/` 里，而不是仓库根？**
> pnpm 的严格隔离意味着 `react` 只能从 `site/node_modules` 解析到。
> MDX 会编译成 import `react/jsx-runtime` 的代码，
> 放在包根之外的 `.mdx` 文件会因解析不到该模块而构建失败。

## 快速开始

需要 Node.js ≥ 22.18（内容校验依赖 Node 原生 TypeScript 加载）与 pnpm。

```bash
pnpm install --dir site     # 安装业务工程依赖
pnpm install                # 安装根级提交钩子依赖
```

常用的开发与检查命令：

```bash
pnpm dev             # 启动开发服务器
pnpm build           # 内容校验 + 类型检查 + 生产构建 + 每路由入口 + 全部守卫
pnpm check           # 内容校验 + 零硬编码检查 + 类型检查 + ESLint + 格式 + 单测（CI 用）
pnpm validate        # 只校验 content/ 内容是否合法
pnpm extract         # 重新从 MyResume.pdf 生成 content/
pnpm build:posts-index  # 重新扫描 MDX frontmatter 生成文章索引
pnpm build:content   # extract + build:posts-index + 生成净化副本
pnpm verify:content  # 检查页面是否有硬编码文案（应全部来自 content/）
pnpm verify:build    # 检查产物：base 前缀、basename、分块、防 FOUC 脚本
pnpm verify:privacy  # 扫描产物，确认私密字段（手机号）没有泄漏
pnpm verify:search   # 检查搜索索引覆盖与跳转目标是否有效
pnpm verify:seo      # sitemap / robots / manifest / 路由入口 / 404 回退
pnpm test            # 单元与组件测试（Vitest，108 个用例）
pnpm test:coverage   # 带覆盖率（阈值 85%）
pnpm test:e2e        # E2E（146 个用例，桌面 + 移动端）
pnpm check:full      # check + E2E 的完整门禁

# 以自定义域名的形态验证（资源前缀会变成 /）
VITE_SITE_URL=https://fangmu.online pnpm build

pnpm typecheck       # 仅类型检查
pnpm lint            # ESLint
pnpm format          # Prettier 写入格式化
```

你可以进入 `site/` 目录直接执行等价的 `pnpm <script>`。

> **E2E 的浏览器**：本地默认用系统已安装的 Chrome，
> 因此不需要下载 Playwright 的浏览器二进制。
> CI 上会自动改用 Playwright 自带的 Chromium（见 `.github/workflows/ci.yml`）。
> 若本地也想用自带浏览器，执行 `pnpm --dir site run test:e2e:install`。

## 路由与主题

七个路由：`/`、`/about`、`/projects`、`/posts`、`/resume`、`/contact`，以及兜底的 404。
每个页面都是懒加载的独立 chunk，路由级错误边界挂在根路由上。

两个容易踩的点已在代码里处理：

- **`basename` 必须与 Vite 的 `base` 一致。** 路由表用 `import.meta.env.BASE_URL`
  推导 basename，与 `vite.config.ts` 的 `base` 共用同一个来源，
  不会出现"改了 base 忘了改 basename"导致线上路由全挂。
  `pnpm verify:build` 会检查这一点。
- **暗黑模式不能等 React 挂载后再切换**，否则首屏会闪一下白色（FOUC）。
  `index.html` 里有一段阻塞式引导脚本先定好主题类名，
  Zustand 的 theme store 再接管后续切换。`verify:build` 也会检查这段脚本存在。

## 内容工作流

站点内容全部来自 `site/content/`，与组件代码解耦。更新内容的三种方式：

1. **改简历 PDF** → 运行 `pnpm extract` 重新生成 JSON（人工修正规则写在 `extract-pdf.ts` 里，可复现）；
2. **只补文字内容**（如个人简介、项目详情）→ 直接编辑 `content/` 下的 JSON；
3. **写文章** → 在 `content/posts/` 下新增 `.mdx` 文件，然后运行 `pnpm build:posts-index`
   更新元数据索引（正文里可以直接使用 `<Callout>` 与 `<TerminalSession>` 组件）。

三种方式之后都建议跑一次 `pnpm validate`。内容里的 `TODO:` 是待补占位，上线前应清空；
页面上会把它渲染成醒目的「待补充」提示块，而不是生硬的 `TODO:…` 文本。
文章 frontmatter 里的 `draft: true` 可以让文章暂时不出现在列表里，不必删除文件。

### 「零硬编码」是可执行的检查

页面文案必须全部来自 `content/`，这条约定由 `pnpm verify:content` 自动把关：
它从 `content/` 提取事实型字符串，扫描**整个 `src/`**（阶段 10 起从
`src/pages` + `src/components` 扩大而来 —— 之前把文案放进 `src/lib/` 就能绕过检查，
一个"只覆盖部分目录"的守卫比没有守卫更危险），命中即报错并给出文件与行号。

判据刻意收紧到只报真问题（技术名、注释里的框架名、公开资产的 URL 片段、
`status` 这类枚举标识符不算），因为一个动辄几十条误报的检查很快就会被 ignore 掉。

### 隐私边界在「哪些文件进入产物」这一层

最初的做法是条件渲染：组件里读 `profile.privacy.showPhone`，为 false 就不渲染手机号。
`pnpm verify:privacy` 一跑就拦下了：

```
✗ 发现 1 处隐私泄漏：
  site\dist\assets\index-*.js  包含受隐私开关保护的 phone（11 位号码）
```

根因有两个，都值得记住：

1. **条件渲染只能决定"显示什么"，不能决定"传输什么"。**
   数据在 bundle 里，打开 DevTools 就能搜到。
2. **通配 glob 会打包它匹配到的所有文件。**
   即便代码读的是 `profile-public.json`，`import.meta.glob('content/**/*.json')`
   仍然会把含手机号的 `profile.json` 一起内联进产物。

所以现在：构建期生成净化副本（`build-public-content.ts`），
加载器对每个文件用**精确 glob**，再由 `verify:privacy` 在构建后实测产物。

### 为什么内容校验放在构建期

模块顶层的 `throw` **不会**让 Vite 构建失败 —— Vite 只做静态打包，模块体要等浏览器运行时才执行。
所以校验放在 `vite.config.ts` 的 `content-guard` 插件里，在 Node 侧运行才能真正中断构建。
反过来说，运行时不需要重复校验，因此 Zod 是 devDependency，不会进入浏览器产物。

## 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>
```

- `type`：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- `scope`：见 `commitlint.config.js`，例如 `tooling` `router` `ui` `content` `deploy`

提交时 `pre-commit` 钩子会对暂存文件跑 ESLint 与 Prettier，`commit-msg` 钩子会校验提交信息格式。

## 本机环境的两个已知问题

这两个都是**环境**问题，不是项目配置问题。你在自己机器上大概率不会遇到，但如果遇到了，
可以据此排查。

### 1. pnpm 默认布局下 Vite 报 `Cannot find package 'rollup'`

pnpm 的默认 isolated 布局通过 junction 链接依赖，在某些 Windows 组合下 Node 的 ESM
解析器无法穿过这些 junction（CJS 可以），表现为 Vite 启动即报找不到 `rollup`。

本仓库的做法：在 `site/pnpm-workspace.yaml` 里设置 `nodeLinker: hoisted`，改用扁平布局。
**注意**：这会让 pnpm 失去依赖隔离能力，团队项目应改用默认布局。

### 2. Node 无法 spawn 带管道 stdio 的子进程（`EPERM`）

在受限的沙箱环境里，Node 的 `child_process.spawn` 使用管道 stdio 会被拒绝，导致
esbuild（Vite 的依赖）无法启动，进而 `vite build` / `vite dev` / Vitest 全部失败。
解决方式是在具备正常进程权限的终端里运行这些命令。

## License

见 [LICENSE](LICENSE)。
