# 项目路线图（ROADMAP）

> 个人网站学习项目 · React 19 + TypeScript + Vite
> 内容来源：`MyResume.pdf`（1 页中文简历，Chromium/Skia 打印导出）
> 状态：**阶段 0、1 已完成并验证**，等待补充素材后进入阶段 2

---

## 0. 阶段完成记录

### 阶段 1 · PDF → 内容管道 + Zod 类型系统（已完成）

| 项目       | 结果                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| 提取管道   | `pnpm extract` 用 pdfjs-dist 文本层按坐标还原版式，产出 `content/*.json` |
| 类型系统   | Zod schema 作为唯一真相来源，TS 类型由 `z.infer` 推导                    |
| 构建期校验 | `vite.config.ts` 的 `content-guard` 插件，校验失败即中断构建             |
| 校验 CLI   | `pnpm validate`，秒级反馈，并统计 `TODO:` 占位数量                       |
| 浏览器产物 | 235.7 KB（gzip 74.9 KB），**不含 Zod**                                   |
| 验证结果   | validate ✓ typecheck ✓ lint ✓ build ✓                                    |

**阶段 1 踩到的四个真实问题（都值得记住）**

1. **模块顶层 `throw` 不会让 Vite 构建失败。** Vite 只静态打包，模块体要到浏览器才执行。
   我最初把校验写在加载器里，用坏数据实测发现构建照样成功 —— 校验是"假的"。
   正确做法是放进 Vite 插件钩子（Node 侧真实执行）。已用实验模块确认：顶层 throw 被完全无视。
2. **续行合并的判据必须来自实测坐标，不能靠猜。** 这个 PDF 的版式是：
   区块标题 x=30/字号 12.2、条目标题 x=30/字号 10.8、正文 x=43/字号 10.8。
   先后试过"缩进更深""行足够长""句末标点"三种判据，前两种都错，
   最终用"缩进相同 + 上一行无句末标点"才正确。教训：先看原始数据，再写规则。
3. **PDF 会带脏字符与错别字。** 字体缺字形处输出控制字符（`Uni \u0000 app`），
   还有真实拼写错误 `Fangmu. onlien`（应为 online）。脚本内置噪音检测器把这类问题报出来，
   因为**它们不会让构建失败**，只会静默上线。人工修正作为规则写进脚本，保证可复现。
4. **不要把开发期关注点带进运行时。** 校验加进应用代码后，Zod 被打进浏览器产物，
   gzip 从 70 KB 涨到 101 KB。校验只在构建期有意义，于是把 Zod 改为 devDependency。

### 阶段 0 · 脚手架 + 工程规范 + Git（已完成）

| 项目     | 结果                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| 工程骨架 | Vite 7.3.7 + React 19.3.0 + TypeScript 5.9.3（strict 全开）                     |
| 样式     | Tailwind CSS v4.3.3（`@tailwindcss/vite`，配置写在 CSS 内）                     |
| 代码质量 | ESLint 9.39.5 扁平配置（分层：基础 / 配置文件 / src 类型感知）+ Prettier 3.9.10 |
| 提交卡口 | Husky 9 + lint-staged 16 + commitlint 19（Conventional Commits + scope 白名单） |
| 包管理   | pnpm 11.7.0                                                                     |
| 验证结果 | lint ✓ typecheck ✓ format:check ✓ build ✓                                       |
| 提交历史 | 规范提交，钩子文件可执行位与换行符已修正                                        |

### 本机环境问题（与项目配置无关，但会阻塞命令）

| 问题                                 | 症状                                                     | 处理                                                |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| Node ESM 无法穿过 pnpm junction      | `Cannot find package 'rollup'`，而文件就在磁盘上         | `site/pnpm-workspace.yaml` 设 `nodeLinker: hoisted` |
| 受限沙箱拒绝管道 stdio 的 spawn      | esbuild 报 `spawn EPERM`，`vite build` / `vitest` 全失败 | 在具备正常进程权限的终端运行构建与测试              |
| MSYS2 `env.exe` / `sh.exe` 崩溃      | `couldn't create signal pipe`，`git commit` 失败         | 在正常终端提交；项目侧钩子配置本身正确              |
| `.npmrc` 等无 BOM 文件被按 ANSI 解码 | 中文注释被拆坏并吞掉后面的配置项                         | 这类文件只写 ASCII 注释                             |
| `.NET` 相对路径取的是进程 cwd        | 脚本里 `Set-Location` 后写文件仍落到仓库根               | 操作文件一律用绝对路径                              |

---

## 1. 已确认的决策

| 决策项     | 结果                       | 备注                                                                    |
| ---------- | -------------------------- | ----------------------------------------------------------------------- |
| 显示名     | **方睿杰**                 | 与简历 PDF 一致                                                         |
| 仓库名     | **resume**                 | 站点 URL：`https://fangmuyang.github.io/resume/`，故 `base: '/resume/'` |
| 手机号处理 | **1B**                     | 联系页只放邮箱 + 表单；手机号仅保留在简历 PDF 下载件内，正文不出现      |
| 部署平台   | **2B** GitHub Pages        | 配合 `404.html` SPA 回退，保留干净 URL（不用 HashRouter）               |
| 内容范围   | **骨架**                   | PDF 提供事实，网站允许持续增补文章与项目详情                            |
| 语言       | **仅中文**                 | 不上 i18next（无真实使用场景）                                          |
| 文章页     | **6A** 列表 + MDX 详情页   | 先放 2–3 篇学习笔记                                                     |
| 视觉风格   | **7A** 极简开发者风        | 深色为主 + 等宽字体点缀 + 信息密度高                                    |
| 技术深度   | **8 全上**（有取舍，见下） | Redux Toolkit 不上，Storybook 限缩范围                                  |
| 节奏       | **9B** 中步                | 阶段 = 一个可运行的功能切片                                             |

## 2. 技术选型定稿

### 采用

| 技术                             | 在本项目的真实用途（不是摆设）                             |
| -------------------------------- | ---------------------------------------------------------- |
| React 19 + TS + Vite             | 核心栈；React 19 的 `use()`、Actions、原生 metadata 都会讲 |
| React Router 7（Data Router）    | 6 个路由、懒加载、路由级 errorElement、loader 取内容       |
| Zustand                          | 主题（暗黑模式）、搜索面板开合、标签筛选                   |
| TanStack Query                   | 调 GitHub API 拉取公开仓库，展示缓存/重试/loading 骨架     |
| MSW                              | 在测试中 mock 上一条的 GitHub API 响应                     |
| Tailwind CSS + shadcn/ui         | 样式系统与组件基座；组件源码入库当 React 教材              |
| lucide-react                     | 图标                                                       |
| React Hook Form + Zod            | 联系表单；Zod 另用于**内容数据的运行时校验**               |
| Framer Motion                    | 页面过渡、卡片入场、暗黑模式切换动效                       |
| MDX（`@mdx-js/rollup`）          | 文章/笔记正文，可在 Markdown 里嵌 React 组件               |
| Fuse.js                          | 站内搜索：项目、文章、技能统一索引                         |
| 自建轻量 SEO 方案                | React 19 原生 `<title>`/`<meta>` 提升，不引第三方库        |
| Vitest + React Testing Library   | 单元与组件测试                                             |
| Playwright                       | E2E：暗色持久化、搜索、路由子路径刷新、表单                |
| ESLint 9 + Prettier              | 代码质量                                                   |
| Husky + lint-staged + commitlint | 提交前拦截 + Conventional Commits 校验                     |
| pnpm                             | 包管理                                                     |
| GitHub Actions                   | lint → typecheck → test → build → deploy 流水线            |
| vite-plugin-pwa                  | 可安装 + 离线访问                                          |

### 明确不采用（记录理由，避免"为用而用"）

| 技术               | 不采用的理由                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| Redux Toolkit      | 全局状态只有 3 个 UI 开关，Zustand 已足够；引入 Redux 是过度设计           |
| Storybook          | 有价值但维护成本高、会稀释主线；改为在 `docs/` 用代码块 + 截图记录组件用法 |
| i18next            | 无多语言真实需求                                                           |
| Next.js            | 纯静态内容站无 SSR 需求，服务端心智负担会稀释 React 基础学习               |
| react-helmet-async | React 19 原生支持在组件内渲染 `<title>`/`<meta>`                           |

## 3. 页面与数据流

```
MyResume.pdf
     │  scripts/extract-pdf.mjs（pdfjs-dist 文本层，可按需重跑）
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

| 路由        | 内容                                                    |
| ----------- | ------------------------------------------------------- |
| `/`         | Hero（姓名/一句话定位）· 能力概览 · 精选项目 · 最新笔记 |
| `/about`    | 个人简介、教育经历、专业技能分组、时间线                |
| `/projects` | 项目卡片 + 标签筛选；`/projects/:slug` 详情             |
| `/posts`    | 笔记列表 + 标签筛选；`/posts/:slug` MDX 正文            |
| `/resume`   | 网页版简历 + PDF 预览/下载                              |
| `/contact`  | 邮箱 + 联系表单（Zod 校验，前端模拟提交）               |

## 4. 阶段路线图（9B 中步节奏）

| 阶段   | 目标切片                        | 引入的核心技术                                                            | 验收检查点                                                            | 状态    |
| ------ | ------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| **0**  | 脚手架 + 工程规范 + Git         | Vite、TS strict、ESLint 9、Prettier、Husky、lint-staged、commitlint、pnpm | lint/typecheck/build 全绿；提交历史规范                               | ✅ 完成 |
| **1**  | PDF → 内容管道 + Zod 类型系统   | pdfjs-dist、Zod、内容/代码分离                                            | `pnpm extract` 可重跑产出 `content/*.json`；schema 校验失败时构建报错 | ✅ 完成 |
| **2**  | 路由 + 布局 + 暗黑模式 + 响应式 | React Router、shadcn/ui、Zustand、Framer Motion                           | 6 个路由可达；暗色刷新后保持；移动端无横向滚动                        | ⬜      |
| **3**  | 首页 + 关于我                   | 组件设计、设计令牌、动画                                                  | 内容全部来自 `content/`，零硬编码文案                                 | ⬜      |
| **4**  | 项目/作品集 + 标签筛选          | 动态路由、筛选状态、卡片动效                                              | 筛选可用；详情页可直接刷新打开                                        | ⬜      |
| **5**  | 文章/笔记（MDX）                | MDX、代码高亮、构建期内容收集                                             | MDX 内可嵌入 React 组件并正常渲染                                     | ⬜      |
| **6**  | 简历页 + PDF 预览/下载          | pdfjs-dist 前端预览、文件下载                                             | PDF 可预览可下载；**手机号不在网页正文出现**                          | ⬜      |
| **7**  | 搜索 + 联系表单                 | Fuse.js、React Hook Form + Zod                                            | 搜索命中项目/文章/技能；表单非法输入有提示                            | ⬜      |
| **8**  | GitHub API + Query + MSW        | TanStack Query、MSW                                                       | 动态仓库列表有 loading/error 态；测试中网络被 mock                    | ⬜      |
| **9**  | 测试体系 + E2E                  | Vitest、RTL、Playwright、覆盖率                                           | 单测与 E2E 全绿                                                       | ⬜      |
| **10** | SEO + PWA + 可访问性 + 性能     | React 19 metadata、vite-plugin-pwa、a11y、Lighthouse                      | Lighthouse 四维 ≥ 90；可安装为 PWA                                    | ⬜      |
| **11** | CI/CD + 部署 + 自定义域名       | GitHub Actions、GitHub Pages、404.html 回退                               | push 后自动部署成功；子路径刷新不 404                                 | ⬜      |
| **12** | 学习文档                        | 归档                                                                      | `docs/LEARNING.md` 覆盖 9 大章节                                      | ⬜      |

每个阶段交付时统一包含：**目标 · 步骤 · 关键代码 · 代码解释 · 常见坑 · 练习建议 · 检查点**。

## 5. 部署方案（GitHub Pages 细节）

- **仓库名决定站点 URL**：仓库 `resume` → `https://fangmuyang.github.io/resume/`
- 因此 Vite 必须设 `base: '/resume/'`，React Router 必须设 `basename="/resume"`
- **SPA 刷新 404 回退**：构建时额外产出 `404.html`（复制 `index.html` 并写入重定向脚本）
- **自定义域名 `fangmu.online`**：需在域名服务商添加 `CNAME` 指向 `fangmuyang.github.io`，
  并在仓库 Settings → Pages 填域名、开启 Enforce HTTPS
- **重要提醒**：`fangmu.online` 当前解析在阿里云（境内），若指向 GitHub Pages（境外），
  域名在境内会被要求完成 ICP 备案。建议**先只用默认的 `github.io` 地址**，域名切换留到阶段 11 决策

## 6. 待补齐信息（阻塞阶段 3 之后的内容填充）

1. 项目截图（否则作品集页只能纯文字）
2. 各项目的技术栈标签（用于分类筛选）
3. 个人简介一段话（PDF 里没有自我介绍）
4. 是否公开 PDF（含真实手机号，建议仓库先设为 Private）

## 7. 环境备注

- 工作区 `C:\Dsh\Resume` 的 Windows 文件权限已诊断并修复（报告：`C:\Dsh\Resume-acl-recovery\`）
- 本机 TLS 为本地代理证书链，**Node 网络请求需加 `--use-system-ca`**，pnpm 安装同理
- 工具目录 `.tools/` 为临时验证用，**不进仓库**（已写入 `.gitignore`）
- 工具配置文件（`.npmrc`、`pnpm-workspace.yaml`）**只写 ASCII 注释**：Node 在 Windows 上
  对无 BOM 文件按系统 ANSI 解码，中文注释会被拆坏并吞掉后续配置项
- 工具配置（`vite.config.ts`、`eslint.config.js`、`tsconfig.json`）注释用英文，
  让中文只出现在学习内容与业务代码里
