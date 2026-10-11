# 项目路线图（ROADMAP）

> 个人网站学习项目 · React 19 + TypeScript + Vite
> 内容来源：`MyResume.pdf`（1 页中文简历，Chromium/Skia 打印导出）
> 状态：**阶段 0–4 已完成并验证**，等待补充素材后进入阶段 5

---

## 0. 阶段完成记录

### 阶段 4 · 作品集 + 标签筛选 + 详情页（已完成）

| 项目     | 结果                                                                                 |
| -------- | ------------------------------------------------------------------------------------ |
| 列表页   | `/projects`，标签筛选状态由 URL 承载，空状态给出下一步动作                           |
| 详情页   | `/projects/:slug`，用 React Router loader 预取数据，找不到 slug 时抛 404 Response    |
| 相关项目 | 按共享标签数量排序，无交集时退化为其余项目而非留空                                   |
| 组件     | `ProjectCard`（可复用于列表与相关推荐）、`TagFilter`（含 aria-pressed 与 aria-live） |
| 图片处理 | `resolveAssetUrl` 给运行时拼接的路径补 BASE_URL，避免子路径部署 404                  |
| 验证结果 | validate ✓ verify:content ✓ typecheck ✓ lint ✓ format ✓ build ✓ verify:build ✓       |

**阶段 4 解决的问题与踩坑记录**

1. **筛选状态该放 Zustand 还是 URL？** 答案是 URL。筛选有三个硬需求：
   可分享链接、刷新保持、后退可用 —— 本质都是「状态要存在于 URL 里」。
   放进客户端 store 就得自己实现 history 同步，很容易和浏览器前进后退打架。
   细节：切换标签用 `replace` 而不是 `push`，否则连点五个标签后要按五次后退才能离开。
2. **运行时拼接的图片路径会 404。** `base` 设为 `/resume/` 后，Vite 处理的资源会自动带前缀，
   但内容 JSON 里手写的 `/images/foo.png` 是普通字符串，Vite 不会碰它。
   必须显式补 `import.meta.env.BASE_URL`。
3. **loader 用动态 `import()` 会让同一个路由产生两个 chunk。** 产物里同时出现
   `projects-D6xrOzUB.js` 和 `projects-Dgp3PNHs.js` 就是症状。改成文件顶部静态导入后，
   重复分块消失，loader 也不再被推迟加载 —— 一举两得。
4. **验证脚本自己出了三次错，比被测代码的问题还多。**
   - 第一版写死「七个路由」，加了详情页后检查静默失效；
   - 第二版改用「带 hash 的文件名 = 路由分块」，判据不成立（共享 chunk 也带 hash），
     而且正则写错：`[a-z0-9-]*` 是贪婪的，能吞掉 hash 的一部分，结果匹配了**所有**文件；
   - 第三版想用「hash 固定 8 位」锚定，仍失败 —— 换文件名解析时又用了贪婪的
     `^(.+)-[A-Za-z0-9_-]+\.js$`，把 `projects-7uUMK-rM.js` 的模块名切成 `projects-7uUMK`
     （hash 本身含连字符）。
   - 最终做法：从路由表解析出可信的模块名清单（`import('@/pages/xxx')`），
     再核对每个模块**恰好**产出一个 chunk。
     **教训：验证脚本的判据必须逐个用真实数据核对过才能信。一个错误的检查比没有检查更糟
     —— 它给出虚假的安全感，还会让人花时间排查不存在的问题。**
5. **`verify:content` 又抓到一处真实硬编码。** 我在列表页写了引导语
   「覆盖移动端、AI 应用与数据可视化方向」，而「AI 应用」恰好是内容里的标签。
   这次没有加白名单，而是把引导语变成 `project.listIntro` 内容字段。

### 阶段 3 · 首页 + 关于我（已完成）

| 项目     | 结果                                                                           |
| -------- | ------------------------------------------------------------------------------ |
| 首页     | Hero + 精选项目 + 能力概览 + 教育背景，全部由 `content/` 驱动                  |
| 关于我   | 个人简介、教育经历时间线、获奖、技能分组、联系方式                             |
| 动画     | `Reveal` / `RevealList` / `RevealItem`：滚动入场 + staggerChildren 依次入场    |
| 占位呈现 | `TextWithPlaceholder` 把 `TODO:` 字段渲染成醒目的「待补充」提示块              |
| 新增守卫 | `pnpm verify:content` 自动检查「页面文案零硬编码」                             |
| 验证结果 | validate ✓ verify:content ✓ typecheck ✓ lint ✓ format ✓ build ✓ verify:build ✓ |

**阶段 3 解决的问题与踩坑记录**

1. **`TODO:` 占位该不该显示？** 直接渲染会出现生硬的 `TODO:一句话自我介绍…`；
   悄悄替换成空字符串更糟 —— 你会忘记还有内容没写。最终选第三条路：
   **保留事实但渲染成醒目的提示块**，发布前由 `pnpm validate` 统计剩余数量。
2. **`whileInView` 必须配 `viewport={{ once: true }}`。** 否则元素每次滚出再滚入
   都重新播放动画，反复触发既廉价又浪费布局计算。
3. **`Reveal as="li"` 这类动态取值不能用 `motion[as]`。** 需要断言类型，
   且传入不存在的标签要到运行时才炸。改成显式映射 `{ div, li, section }`，
   代价两行，换来类型安全与拼错立即可见。
4. **`exactOptionalPropertyTypes` 第二次拦下类型问题。** `EASE_OUT` 原本声明为
   `Transition['ease']`（含 `undefined`），无法赋给 `Transition` 的可选 `ease` 属性。
   改成具体元组类型 `[number, number, number, number]` 才正确。
5. **Fast Refresh 约束又出现一次。** `text-with-placeholder.tsx` 同时导出组件与
   `isPlaceholder` 会触发规则，把判定函数移到 `lib/content-placeholder.ts`。
6. **「零硬编码」必须可执行，不能靠自觉。** 我写了 `verify-content-usage.ts`：
   从 `content/` 提取事实型字符串（59 条），扫描页面与组件，命中即报错。
   第一版判据太糙（误报 19 处，React / TypeScript 这些技术名全中），
   收紧为「含空格或标点、或长度 ≥ 8 的单词语」后，**只剩 1 处真实命中** ——
   footer 里硬编码的「React 19 + TypeScript」。这处确实该修，
   于是把它变成 `profile.builtWith` 数据。
   教训：守卫脚本的判据要收紧到"只报真问题"，否则很快会被 ignore 掉。

### 阶段 2 · 路由 + 布局 + 暗黑模式 + 响应式（已完成）

| 项目     | 结果                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 路由     | React Router 7 数据路由，7 个路由（6 页面 + 404），全部懒加载，路由级错误边界                                                               |
| 布局     | 根布局 + Header（桌面导航 / 移动端抽屉）+ Footer，响应式栅格                                                                                |
| 主题     | Zustand 管理，支持 light/dark/system，跟随系统变化，并尊重 prefers-reduced-motion                                                           |
| 设计系统 | Button（cva 变体）/ Card / Badge / Container / Slot，cn() = clsx + tailwind-merge                                                           |
| 动画     | Motion 做路由切换过渡，参数集中在 lib/motion.ts                                                                                             |
| 分包     | vendor-react 213.5 KB(gzip 66.4) · vendor-router 99.2(33.7) · vendor-motion 96.8(32.2) · vendor-state 0.7 · 应用 88.1(31.1) · CSS 18.3(4.4) |
| 验证结果 | validate ✓ typecheck ✓ lint ✓ format ✓ build ✓ verify:build ✓                                                                               |

**阶段 2 解决的问题与踩坑记录**

1. **FOUC（首屏闪白）。** 若等 React 挂载后再加 `.dark` 类，用户会看到一瞬间白色。
   解法是 `index.html` 里的**阻塞式**引导脚本先定主题，Zustand store 读取既成事实再接续管理。
   脚本刻意写成 ES5 并包 try/catch —— 主题引导不能阻塞整页渲染。
2. **`basename` 与 `base` 必须同源。** 路由表用 `import.meta.env.BASE_URL` 推导，
   与 `vite.config.ts` 的 `base` 共用一处定义，避免"改了 base 忘了 basename"。
   并加 `verify:build` 在构建后实测这一点。
3. **在 effect 里同步 setState 是反模式。** 移动端抽屉原本用
   `useEffect(() => setOpen(false), [pathname])` 收起，ESLint 的
   `react-hooks/set-state-in-effect` 直接报错。改用 **key 重置状态**：
   父组件传 `key={pathname}`，路由一变组件重挂载、状态自然归零，零 effect 零额外渲染。
4. **Fast Refresh 要求模块只导出组件。** `buttonVariants` 与 `Button` 同文件会触发
   `react-refresh/only-export-components`，导致热更新退化成整页刷新。拆成两个文件。
5. **`exactOptionalPropertyTypes` 会拦下 `ref` 类型不匹配。** Slot 最初声明
   `ref?: Ref<HTMLElement>` 与按钮的 `Ref<HTMLButtonElement>` 冲突；
   改成 `ref?: Ref<unknown> | undefined` 才正确（`| undefined` 不能省）。
6. **vendor 分包规则的陷阱。** `manualChunks: { 'vendor-react': ['react', 'react-dom'] }`
   看着对，实测 `vendor-react` 只有 4 KB —— 因为 `react-dom/client` 与
   `react/jsx-runtime` 没被规则覆盖，全掉进了主 chunk。补全入口后才是真实的 213 KB。
   教训：分包配置必须**用实测产物验证**，不能凭直觉相信。
7. **不做无依据的优化。** 主 chunk 一度是 499 KB，我没有直接"优化"，
   而是先分包归因：确认 88 KB 的应用 chunk 里是内联的内容 JSON、图标与少量库代码，
   没有浪费，于是停手。图标已确认被正确 tree-shake（未使用的图标名都不在产物里）。

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

| 问题                                 | 症状                                                     | 处理                                                                           |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Node ESM 无法穿过 pnpm junction      | `Cannot find package 'rollup'`，而文件就在磁盘上         | `site/pnpm-workspace.yaml` 设 `nodeLinker: hoisted`                            |
| 受限沙箱拒绝管道 stdio 的 spawn      | esbuild 报 `spawn EPERM`，`vite build` / `vitest` 全失败 | 在具备正常进程权限的终端运行构建与测试                                         |
| MSYS2 `env.exe` / `sh.exe` 崩溃      | `couldn't create signal pipe`，`git commit` 失败         | 在正常终端提交；项目侧钩子配置本身正确                                         |
| `.npmrc` 等无 BOM 文件被按 ANSI 解码 | 中文注释被拆坏并吞掉后面的配置项                         | 这类文件只写 ASCII 注释                                                        |
| `.NET` 相对路径取的是进程 cwd        | 脚本里 `Set-Location` 后写文件仍落到仓库根               | 操作文件一律用绝对路径                                                         |
| 沙箱内无法监听端口                   | `vite preview` / `vite dev` 起不来，端口无监听           | 视觉与交互验证留给阶段 9 的 Playwright；当前用产物级验证（`verify:build`）替代 |

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
| **2**  | 路由 + 布局 + 暗黑模式 + 响应式 | React Router、shadcn/ui、Zustand、Framer Motion                           | 6 个路由可达；暗色刷新后保持；移动端无横向滚动                        | ✅ 完成 |
| **3**  | 首页 + 关于我                   | 组件设计、设计令牌、动画                                                  | 内容全部来自 `content/`，零硬编码文案                                 | ✅ 完成 |
| **4**  | 项目/作品集 + 标签筛选          | 动态路由、筛选状态、卡片动效                                              | 筛选可用；详情页可直接刷新打开                                        | ✅ 完成 |
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
