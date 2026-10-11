# 项目路线图（ROADMAP）

> 个人网站学习项目 · React 19 + TypeScript + Vite
> 内容来源：`MyResume.pdf`（1 页中文简历，Chromium/Skia 打印导出）
> 状态：**计划已定稿，等待 3 项信息补齐后进入阶段 0**

---

## 1. 已确认的决策

| 决策项 | 结果 | 备注 |
|---|---|---|
| 手机号处理 | **1B** | 联系页只放邮箱 + 表单；手机号仅保留在简历 PDF 下载件内，正文不出现 |
| 部署平台 | **2B** GitHub Pages | 配合 `404.html` SPA 回退，保留干净 URL（不用 HashRouter） |
| 内容范围 | **骨架** | PDF 提供事实，网站允许持续增补文章与项目详情 |
| 语言 | **仅中文** | 不上 i18next（无真实使用场景，避免为用而用） |
| 文章页 | **6A** 列表 + MDX 详情页 | 先放 2–3 篇学习笔记 |
| 视觉风格 | **7A** 极简开发者风 | 深色为主 + 等宽字体点缀 + 信息密度高 |
| 技术深度 | **8 全上**（有取舍，见下） | Redux Toolkit 不上，Storybook 限缩范围 |
| 节奏 | **9B** 中步 | 阶段 = 一个可运行的功能切片 |

## 2. 技术选型定稿

### 采用

| 技术 | 在本项目的真实用途（不是摆设） |
|---|---|
| React 19 + TS + Vite | 核心栈；React 19 的 `use()`、Actions、原生 metadata 都会讲 |
| React Router 7（Data Router） | 6 个路由、懒加载、路由级 errorElement、loader 取内容 |
| Zustand | 主题（暗黑模式）、搜索面板开合、标签筛选 |
| TanStack Query | 调 GitHub API 动态拉取公开仓库，展示缓存/重试/loading 骨架 |
| MSW | 在测试中 mock 上一条的 GitHub API 响应 |
| Tailwind CSS + shadcn/ui | 样式系统与组件基座；组件源码入库当 React 教材 |
| lucide-react | 图标 |
| React Hook Form + Zod | 联系表单；Zod 另用于**内容数据的运行时校验** |
| Framer Motion | 页面过渡、卡片入场、暗黑模式切换动效 |
| MDX（`@mdx-js/rollup`） | 文章/笔记正文，可在 Markdown 里嵌 React 组件 |
| Fuse.js | 站内搜索：项目、文章、技能统一索引 |
| 自建轻量 SEO 方案 | React 19 原生 `<title>`/`<meta>` 提升，不引第三方库 |
| Vitest + React Testing Library | 单元与组件测试 |
| Playwright | E2E：暗色持久化、搜索、路由子路径刷新、表单 |
| ESLint 9 + Prettier | 代码质量 |
| Husky + lint-staged + commitlint | 提交前拦截 + Conventional Commits 校验 |
| pnpm | 包管理（工作区已内置 pnpm 11.7.0） |
| GitHub Actions | lint → typecheck → test → build → deploy 流水线 |
| vite-plugin-pwa | 可安装 + 离线访问 |

### 明确不采用（记录理由，避免"为用而用"）

| 技术 | 不采用的理由 |
|---|---|
| Redux Toolkit | 本项目全局状态只有 3 个 UI 开关，Zustand 已足够；引入 Redux 是过度设计 |
| Storybook | 有价值但维护成本高，且会稀释主线；改为在 `docs/` 用代码块 + 截图记录组件用法 |
| i18next | 无多语言真实需求 |
| Next.js | 纯静态内容站无 SSR 需求，服务端心智负担会稀释 React 基础学习 |
| react-helmet-async | React 19 原生支持在组件内渲染 `<title>`/`<meta>` |

## 3. 页面与数据流

```
MyResume.pdf
     │  scripts/extract-pdf.ts（pdfjs-dist 文本层，可按需重跑）
     ▼
content/*.json + content/posts/*.mdx     ← 内容与代码分离，唯一真相来源
     │  Zod schema 运行时校验（构建期失败即报错）
     ▼
src/lib/content.ts  →  Vite import.meta.glob 构建期收集  →  类型安全的 loader
     │                                                        │
     │  Fuse.js 构建期生成搜索索引                             │
     ▼                                                        ▼
Zustand(theme/search/tag) ──────────────▶  React Router loader ──▶ 页面组件
```

**六个页面**

| 路由 | 内容 |
|---|---|
| `/` | Hero（姓名/一句话定位）· 能力概览 · 精选项目 · 最新笔记 |
| `/about` | 个人简介、教育经历、专业技能分组、时间线 |
| `/projects` | 项目卡片 + 标签筛选；`/projects/:slug` 详情 |
| `/posts` | 笔记列表 + 标签筛选；`/posts/:slug` MDX 正文 |
| `/resume` | 网页版简历 + PDF 预览/下载 |
| `/contact` | 邮箱 + 联系表单（Zod 校验，前端模拟提交） |

## 4. 阶段路线图（9B 中步节奏）

| 阶段 | 目标切片 | 引入的核心技术 | 验收检查点 |
|---|---|---|---|
| **0** | 脚手架 + 工程规范 + Git 首次提交 | Vite、TS strict、ESLint 9 flat config、Prettier、Husky、lint-staged、commitlint、pnpm | `pnpm lint` / `typecheck` / `build` 全绿；首次提交被 commitlint 校验通过 |
| **1** | PDF → 内容管道 + Zod 类型系统 | pdfjs-dist、Zod、内容/代码分离 | `pnpm extract` 可重跑产出 `content/*.json`；schema 校验失败时构建报错 |
| **2** | 路由 + 布局 + 暗黑模式 + 响应式 | React Router、Tailwind、shadcn/ui、Zustand、Framer Motion | 6 个路由可达；暗色模式刷新后保持；移动端无横向滚动 |
| **3** | 首页 + 关于我 | 组件设计、设计令牌、动画 | 内容全部来自 `content/`，零硬编码文案 |
| **4** | 项目/作品集 + 标签筛选 | 动态路由、筛选状态、卡片动效 | 筛选可用；详情页可直接刷新打开 |
| **5** | 文章/笔记（MDX） | MDX、代码高亮、构建期内容收集 | MDX 内可嵌入 React 组件并正常渲染 |
| **6** | 简历页 + PDF 预览/下载 | pdfjs-dist 前端预览、文件下载 | PDF 可预览可下载；**手机号不在网页正文出现** |
| **7** | 搜索 + 联系表单 | Fuse.js、React Hook Form + Zod | 搜索命中项目/文章/技能；表单非法输入有提示 |
| **8** | GitHub API + Query + MSW | TanStack Query、MSW | 动态仓库列表有 loading/error 态；测试中网络被 mock |
| **9** | 测试体系 + E2E | Vitest、RTL、Playwright、覆盖率 | 单测与 E2E 全绿 |
| **10** | SEO + PWA + 可访问性 + 性能 | React 19 metadata、vite-plugin-pwa、a11y、Lighthouse | Lighthouse 四维 ≥ 90；可安装为 PWA |
| **11** | CI/CD + 部署 + 自定义域名 | GitHub Actions、GitHub Pages、404.html 回退 | push 后自动部署成功；子路径刷新不 404 |
| **12** | 学习文档 | 归档 | `docs/LEARNING.md` 覆盖 9 大章节 |

每个阶段交付时统一包含：**目标 · 步骤 · 关键代码 · 代码解释 · 常见坑 · 练习建议 · 检查点**。

## 5. 部署方案（GitHub Pages 细节）

- **仓库名决定站点 URL**：仓库 `personal-site` → `https://fangmuyang.github.io/personal-site/`
- 因此 Vite 必须设 `base: '/personal-site/'`，React Router 必须设 `basename`
- **SPA 刷新 404 回退**：构建时额外产出 `404.html`（复制 `index.html` 并写入重定向脚本），这是 gh-pages 官方推荐做法，比 HashRouter 更好的地方是 URL 保持干净
- **自定义域名 `fangmu.online`**：需要你在域名服务商添加 `CNAME` 指向 `fangmuyang.github.io`，并在仓库 Settings → Pages 填入域名、开启 Enforce HTTPS
- **重要提醒**：`fangmu.online` 当前解析在阿里云（境内），若把域名指向 GitHub Pages（境外），域名本身在境内会被要求完成 ICP 备案，否则访问可能被阻断。建议**先只用默认的 `github.io` 地址**，域名切换留到阶段 11 再决策。

## 6. 待补齐信息（阻塞阶段 3 之后的内容填充）

1. 网站显示名：`方睿杰`（PDF）还是 `方沐`（GitHub）？还是"方睿杰（方沐）"？
2. 仓库名（决定站点 URL 与 `base` 配置）
3. 项目截图、各项目技术栈标签、个人简介一段话

## 7. 环境备注

- 工作区 `C:\Dsh\Resume` 的 Windows 文件权限已诊断并修复（报告：`C:\Dsh\Resume-acl-recovery\`）
- 本机 TLS 为本地代理证书链，**Node 网络请求需加 `--use-system-ca`**，pnpm 安装也需同样处理
- 工具目录 `.tools/` 为临时验证用，**不进仓库**（写入 `.gitignore`）
