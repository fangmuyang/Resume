# 方睿杰 · 个人网站

用 React 19 + TypeScript 从零构建的个人网站，内容源自一份 PDF 简历。这个仓库同时是一份
**可运行的学习范本**：每一层技术选型都对应一个真实需求，并在 `docs/` 里配有说明。

- 站点地址（规划）：https://fangmuyang.github.io/resume/
- 内容来源：`MyResume.pdf`
- 阶段路线图：[`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## 技术栈

| 层次 | 选型 | 在本项目中的作用 |
| --- | --- | --- |
| 核心 | React 19 · TypeScript 5.9 | 组件与类型系统 |
| 构建 | Vite 7 | 开发服务器与生产构建 |
| 样式 | Tailwind CSS v4 | 原子化样式，配置写在 CSS 里 |
| 质量 | ESLint 9 · Prettier 3 | 静态检查与格式化 |
| 提交 | Husky · lint-staged · commitlint | 本地提交卡口 + 提交信息规范 |

后续阶段会依次加入 React Router、Zustand、TanStack Query、Zod、MDX、Fuse.js、
Vitest、Playwright、PWA 与 GitHub Actions，详见路线图。

## 目录结构

```
.
├── MyResume.pdf          # 内容来源（唯一真相来源）
├── docs/
│   └── ROADMAP.md        # 阶段路线图与技术决策记录
├── site/                 # 业务工程（React + TS + Vite）
│   ├── src/
│   │   ├── main.tsx      # 应用入口
│   │   ├── App.tsx       # 根组件（阶段 2 后替换为路由表）
│   │   └── styles/
│   │       └── index.css # Tailwind v4 入口 + 设计令牌
│   ├── eslint.config.js  # ESLint 9 扁平配置
│   ├── tsconfig.json     # 严格模式全开
│   └── vite.config.ts
├── .husky/               # Git 提交钩子
├── lint-staged.config.js
└── commitlint.config.js
```

## 快速开始

需要 Node.js ≥ 22.12 与 pnpm。

```bash
pnpm install --dir site     # 安装业务工程依赖
pnpm install                # 安装根级提交钩子依赖
```

常用的开发与检查命令：

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 类型检查 + 生产构建
pnpm typecheck    # 仅类型检查
pnpm lint         # ESLint
pnpm format       # Prettier 写入格式化
```

你也可以进入 `site/` 目录直接执行等价的 `pnpm <script>`。

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
