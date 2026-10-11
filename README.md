# 方睿杰 · 个人网站

用 React 19 + TypeScript 从零构建的个人网站，内容源自一份 PDF 简历。这个仓库同时是一份
**可运行的学习范本**：每一层技术选型都对应一个真实需求，并在 `docs/` 里配有说明。

- 站点地址（规划）：https://fangmuyang.github.io/resume/
- 内容来源：`MyResume.pdf`
- 阶段路线图：[`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## 技术栈

| 层次 | 选型                             | 在本项目中的作用            |
| ---- | -------------------------------- | --------------------------- |
| 核心 | React 19 · TypeScript 5.9        | 组件与类型系统              |
| 构建 | Vite 7                           | 开发服务器与生产构建        |
| 样式 | Tailwind CSS v4                  | 原子化样式，配置写在 CSS 里 |
| 质量 | ESLint 9 · Prettier 3            | 静态检查与格式化            |
| 提交 | Husky · lint-staged · commitlint | 本地提交卡口 + 提交信息规范 |

后续阶段会依次加入 React Router、Zustand、TanStack Query、Zod、MDX、Fuse.js、
Vitest、Playwright、PWA 与 GitHub Actions，详见路线图。

## 目录结构

```
.
├── MyResume.pdf          # 内容来源（唯一真相来源）
├── content/              # 内容与代码分离：由 PDF 提取出的站点内容
│   ├── profile.json      # 个人信息、联系方式、隐私开关
│   ├── resume.json       # 教育经历、项目概览、奖项
│   ├── skills.json       # 技能分组
│   ├── projects/*.json   # 作品集详情（文件名即 slug）
│   └── raw/              # PDF 原始文本行，便于核对与 diff
├── docs/
│   └── ROADMAP.md        # 阶段路线图与技术决策记录
├── site/                 # 业务工程（React + TS + Vite）
│   ├── scripts/
│   │   ├── extract-pdf.ts      # PDF → content/ 的可复现管道
│   │   └── validate-content.ts # 内容校验 CLI
│   ├── src/
│   │   ├── lib/content/
│   │   │   ├── schema/   # Zod schema（类型唯一真相来源）
│   │   │   ├── validate.ts     # 校验逻辑（构建期与 CLI 共用）
│   │   │   └── index.ts        # 类型安全的内容加载器
│   │   ├── main.tsx      # 应用入口
│   │   ├── App.tsx       # 根组件（阶段 2 后替换为路由表）
│   │   └── styles/index.css    # Tailwind v4 入口 + 设计令牌
│   ├── eslint.config.js  # ESLint 9 扁平配置
│   ├── tsconfig.json     # 严格模式全开
│   └── vite.config.ts    # 含构建期内容校验插件 content-guard
├── .husky/               # Git 提交钩子
├── lint-staged.config.js
└── commitlint.config.js
```

## 快速开始

需要 Node.js ≥ 22.18（内容校验依赖 Node 原生 TypeScript 加载）与 pnpm。

```bash
pnpm install --dir site     # 安装业务工程依赖
pnpm install                # 安装根级提交钩子依赖
```

常用的开发与检查命令：

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 内容校验 + 类型检查 + 生产构建
pnpm validate     # 只校验 content/ 内容是否合法
pnpm extract      # 重新从 MyResume.pdf 生成 content/
pnpm typecheck    # 仅类型检查
pnpm lint         # ESLint
pnpm format       # Prettier 写入格式化
```

你也可以进入 `site/` 目录直接执行等价的 `pnpm <script>`。

## 内容工作流

站点内容全部来自 `content/`，与组件代码解耦。更新内容的两种方式：

1. **改简历 PDF** → 运行 `pnpm extract` 重新生成 JSON（人工修正规则写在 `extract-pdf.ts` 里，可复现）；
2. **只补文字内容**（如个人简介、项目详情）→ 直接编辑 `content/` 下的 JSON。

两种方式之后都建议跑一次 `pnpm validate`。内容里的 `TODO:` 是待补占位，上线前应清空。

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
