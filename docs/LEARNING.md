# 技术学习文档

这份文档不是 API 手册，而是**这个项目为什么这么写**的完整记录。
每一个结论都来自一次真实的踩坑或一次反直觉的发现 —— 猜测和"最佳实践"口号都已被删掉，
留下来的要么有实测数据，要么有明确的技术理由。

如果你只想看某一层，按下表进去；若想理解整体设计，建议按顺序读。

| 章节                                   | 主题                    | 你会得到什么                                      |
| -------------------------------------- | ----------------------- | ------------------------------------------------- |
| [1](#1-项目全貌与设计约束)              | 项目全貌与设计约束      | 为什么这些约束决定了后面所有决策                  |
| [2](#2-技术选型有取有舍)                | 技术选型（有取有舍）    | 每项技术的落地点，以及**刻意不采用**的理由  |
| [3](#3-内容管道从-pdf-到类型安全的内容) | 内容管道                | PDF → JSON → Zod → 构建期校验的完整链路        |
| [4](#4-typescript-严格模式实战)         | TypeScript 严格模式实战 | 四个额外开关各自拦下了什么真实问题                |
| [5](#5-react-19-实战)                   | React 19 实战           | 原生 metadata、`useLayoutEffect` 陷阱、状态归属 |
| [6](#6-样式与主题系统)                  | 样式与主题系统          | Tailwind v4 的设计令牌、防 FOUC、MDX 约束         |
| [7](#7-路由与数据加载)                  | 路由与数据加载          | 数据路由、URL 作为状态源、部署前缀                |
| [8](#8-测试策略)                        | 测试策略                | 三层分工、jsdom 的两个致命陷阱、覆盖率范围        |
| [9](#9-工程守卫与交付)                  | 工程守卫与交付          | 7 个守卫各自防什么"静默失效"+ CI/部署             |

**项目规模**（写完阶段 11 时）：

| 类别                                    | 数量                          | 行数  |
| --------------------------------------- | ----------------------------- | ----- |
| 源码（`src/`，不含测试）              | 71 个文件                     | 4 945 |
| 单元/组件测试                           | 8 个文件                      | 867   |
| E2E 测试                                | 7 个文件                      | 830   |
| 构建与守卫脚本                          | 12 个文件                     | 1 799 |
| 内容（4 个项目 + 3 篇文章 + 若干 JSON） | 12 个文件                     | —    |
| Git 提交                                | 35 次（Conventional Commits） | —    |

**验证状态**：108 个单元测试、146 个 E2E 用例（桌面 + 移动端）、7 个构建产物守卫，
全部通过。CI 与部署配置已完成，但**尚未在真实 GitHub 上跑过** ——
这一点在 [第 9 章](#9-工程守卫与交付) 末尾说清楚了，不掩饰。

---

## 1. 项目全貌与设计约束

### 1.1 这是一个什么样的项目

用 React 19 + TypeScript + Vite 从零构建的个人网站，内容源头是**一份真实的 PDF 简历**。
仓库同时是学习范本：每一层技术选型都对应一个真实需求。

技术栈：

```
React 19 · TypeScript 5.9 · Vite 7 · React Router 7 · Tailwind CSS 4
Zustand 5 · TanStack Query 5 · React Hook Form 7 · Zod 4 · Fuse.js 7
MDX 3 · Motion · pdfjs-dist · Vitest 3 · Playwright · MSW 2 · vite-plugin-pwa
```

### 1.2 五个决定了后面一切的约束

**约束一：内容必须与代码分离。**
网站内容会不断增补（新项目、新文章），如果文案散在组件里，
每次改字都要动代码、重新理解组件结构。所以内容全部放在 `site/content/`，
组件只负责布局。

这条约束后来变成了可执行的检查（`verify:content`），而不是一句口号 ——
见 [第 9 章](#9-工程守卫与交付)。

**约束二：部署在 GitHub Pages 的子路径下。**
站点地址是 `https://fangmuyang.github.io/resume/`，所以：
Vite 的 `base` 必须是 `/resume/`，React Router 的 `basename` 必须是 `/resume`，
且两者**必须来自同一个来源** —— 否则会出现"改了 base 忘了改 basename"，
症状是线上路由全挂。这一约束贯穿 [第 7 章](#7-路由与数据加载)。

**约束三：手机号不能出现在网页正文里，但可以留在 PDF 里。**
这是隐私需求，但**技术上的实现方式决定了它是否真的有效**。
第一版用"条件渲染"隐藏手机号 —— 那是错的：条件渲染只影响 DOM，
数据早已被打进 JS 产物，任何人都能从浏览器下载并搜到。
正确做法是把隐私边界划在"哪些文件进入产物"这一层：
构建时生成脱敏副本 `profile-public.json`，手机号只存在于从未被打包的
`profile.json` 与公开的 PDF 里。详见 [第 3 章](#3-内容管道从-pdf-到类型安全的内容)。

**约束四：PDF 里的字体是 Type3 矢量字形，普通解析器只能得到乱码。**
这直接决定了内容管道必须自己按坐标重建版式，而不是调一个库了事。
见 [第 3 章](#3-内容管道从-pdf-到类型安全的内容)。

**约束五：开发环境受限。**
没有浏览器、装不了需要下载原生二进制的依赖（sharp、Playwright 浏览器）、
一度也无法监听端口。这些限制**逼出了更好的工程习惯**：
把"能不能用"变成可执行的产物级检查，而不是靠肉眼看。
[第 9 章](#9-工程守卫与交付) 的 7 个守卫脚本大部分源于此。

### 1.3 目录结构

```
.
├── MyResume.pdf              # 内容来源（唯一真相）
├── docs/
│   ├── ROADMAP.md            # 阶段记录与决策日志
│   ├── DEPLOYMENT.md         # 部署、自定义域名、排查清单
│   └── LEARNING.md           # 本文档
├── .github/workflows/        # CI 与部署
├── site/                     # 业务工程
│   ├── content/              # 内容与代码分离
│   │   ├── profile.json          # 源头（含手机号，不打包）
│   │   ├── profile-public.json   # 构建期生成的脱敏副本
│   │   ├── resume.json / skills.json / page-meta.json / enum-labels.json
│   │   ├── projects/*.json       # 文件名即 slug
│   │   └── posts/*.mdx
│   ├── scripts/              # 构建、提取与 7 个守卫
│   ├── src/
│   │   ├── app/                  # 路由、布局、错误边界
│   │   ├── components/           # UI 基座
│   │   ├── features/             # 按领域切分（github/projects/posts/search/contact/resume/theme）
│   │   ├── lib/                  # 内容管道、SEO、纯函数
│   │   └── pages/
│   ├── e2e/                  # Playwright 用例
│   └── public/
└── package.json              # 根级：Git 规范与提交钩子
```

> **一个非显然的决定：`content/` 在 `site/` 内部，而不是仓库根。**
> pnpm 的严格隔离意味着 `react` 只能从 `site/node_modules` 解析到。
> MDX 会编译成 `import 'react/jsx-runtime'` 的代码，
> 放在包根之外的 `.mdx` 会因解析不到该模块而构建失败。
> 这不是审美问题，是模块解析规则决定的。

### 1.4 练习

1. 把 `content/` 移回仓库根，观察 `pnpm build` 的报错信息 ——
   理解 pnpm 隔离与 ESM 解析的关系。
2. 在 `src/pages/` 里随便硬编码一句内容文案，运行 `pnpm verify:content`，
   看它如何定位问题。
3. 把 `vite.config.ts` 的 `base` 改成 `'/'`（不部署），
   运行 `pnpm verify:build`，理解它检查的是什么。

---

## 2. 技术选型（有取有舍）

### 2.1 每项技术的真实落地点

"用了某技术"不是价值，"某技术解决了某个具体问题"才是。
下表每一项都能在代码里找到对应位置。

| 技术                             | 解决了什么问题                                            | 落在哪里                                        |
| -------------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| React 19                         | 组件与状态                                                | `src/components`、`src/pages`               |
| TypeScript 5.9                   | 类型安全（严格模式全开）                                  | 全仓；见 [第 4 章](#4-typescript-严格模式实战)   |
| Vite 7                           | 开发服务器、生产构建、分包                                | `vite.config.ts`                              |
| React Router 7                   | 6 个路由、懒加载、**路由级错误边界**、loader 取内容 | `src/app/router.tsx`                          |
| Zustand 5                        | 主题、搜索面板开合                                        | `features/theme`、`features/search`         |
| TanStack Query 5                 | GitHub API 的缓存 / 重试 / 加载态                         | `features/github`                             |
| MSW 2                            | **在网络层** mock 上面那个 API                      | `src/test/msw-handlers.ts`                    |
| Tailwind CSS 4                   | 设计令牌 + 工具类                                         | `src/styles/index.css`                        |
| React Hook Form 7 + Zod 4        | 联系表单校验                                              | `features/contact`                            |
| Zod 4                            | **内容数据的校验**（构建期）                        | `lib/content/schema`                          |
| Fuse.js 7                        | 站内搜索（项目/文章/技能统一索引）                        | `features/search`                             |
| MDX 3                            | 文章正文里嵌 React 组件                                   | `content/posts/*.mdx`                         |
| Motion                           | 页面过渡、卡片入场                                        | `components/motion`                           |
| pdfjs-dist                       | 简历 PDF 提取 + 页面内预览                                | `scripts/extract-pdf.ts`、`features/resume` |
| lucide-react                     | 图标（按需 tree-shaking）                                 | 各处                                            |
| vite-plugin-pwa                  | 可安装 + 离线浏览                                         | `vite.config.ts`                              |
| Vitest 3 + RTL                   | 单元与组件测试                                            | `src/**/*.test.ts(x)`                         |
| Playwright                       | E2E（真实浏览器）                                         | `e2e/`                                        |
| Husky + lint-staged + commitlint | 提交前拦截 + 提交信息规范                                 | 仓库根                                          |

### 2.2 刻意不采用的技术（这部分同样重要）

**Redux Toolkit —— 全局状态只有 3 个 UI 开关。**

本站的"全局状态"是：主题（明/暗）、搜索面板开合。
筛选状态被放进了 URL（见 [第 7 章](#7-路由与数据加载)），不算全局状态。
为两个布尔值引入 Redux 的 action/reducer/store 三件套是明显的过度设计。

判断标准不是"Redux 好不好"，而是"它解决了这里的什么问题" —— 答案是没有。

**Storybook —— 维护成本高于收益。**

组件隔离开发确实有价值，但它意味着额外的构建配置、额外的依赖树、
额外的 CI 步骤，而这个项目的组件数量（十来个）还不足以摊薄这些成本。
改为在代码注释里记录组件用法与边界情况。

**i18next —— 没有多语言的真实需求。**

只有一个用户、一种语言。引入 i18n 会让每一句文案都包一层 `t()`，
增加噪音而不产生价值。如果将来要做，改造成本主要是把文案集中（已经做到了）。

**Next.js —— 纯静态内容站不需要 SSR。**

引入 Next.js 会带来服务端/客户端组件、数据获取边界、缓存策略等一整套额外心智模型。
对"学 React 基础"这个目标来说，这些噪音会稀释重点。
代价是牺牲了预渲染带来的 SEO 优势 —— 这个取舍在
[第 9 章](#9-工程守卫与交付) 里明确记录了。

**react-helmet-async —— React 19 原生支持了。**

React 19 起可以在组件里直接渲染 `<title>` / `<meta>` / `<link>`，
React 会把它们提升到 `<head>`。helmet 的核心价值（SSR 时收集标签）在本项目不成立。
**但这个能力有陷阱**，见 [第 5 章](#5-react-19-实战)。

**Zod 的运行时使用（除了表单）—— 我一度用错，已回退。**

项目从一开始就定下"Zod 只在构建期使用，不进浏览器产物"（它是 devDependency）。
但在接 GitHub API 时，我给响应也写了 Zod schema —— 结果 **Zod 被打成 85 KB 的独立 chunk**
（gzip 24.5 KB），而它换来的只是"少写十几行"：GitHub 的响应结构是**静态且简单**的，
一个手写类型守卫完全够用。

改回手写后该 chunk 消失。判断依据不是"Zod 好不好"，而是**这笔依赖换来了什么**：

| 场景        | 结论   | 理由                                           |
| ----------- | ------ | ---------------------------------------------- |
| 内容 schema | 用 Zod | 复杂：默认值、`refine`、跨字段约束、类型推导 |
| 联系表单    | 用 Zod | 静态站无后端，客户端校验是**必须**的     |
| GitHub 响应 | 不用   | 结构简单，手写守卫 15 行，省 24.5 KB gzip      |

### 2.3 为什么锁定"稳定大版本"而不是最新

选型时 TypeScript 7、ESLint 10、Vite 8、React Router 8 都已发布，
但本项目刻意停在 5.9 / 9 / 7 / 7。

理由：**大版本刚发布时，文档、插件生态与示例代码还停留在上一版。**
踩到问题时搜到的答案往往不适用，而学习阶段的重点是理解机制、不是追新。
等这些版本进入主流后升级，成本远低于现在。

### 2.4 练习

1. 把 `features/github/github-api.ts` 的手写守卫换回 Zod schema，
   跑 `pnpm build` 并对比 `dist/assets` 的 chunk 数量与体积。
2. 思考：如果把标签筛选状态从 URL 移到 Zustand，会破坏哪些需求？
   （提示：可分享链接、刷新保持、浏览器后退）
3. 给"不采用"清单里再加一条，并写出**本站语境下**的具体理由。

---

## 3. 内容管道：从 PDF 到类型安全的内容

### 3.1 完整链路

```
MyResume.pdf
     │  scripts/extract-pdf.ts（pdfjs 文本层 + 坐标聚类）
     ▼
content/*.json + content/posts/*.mdx      ← 内容与代码分离，唯一真相
     │  Zod schema 校验（构建期，在 Vite 插件的 buildStart 里）
     ▼
src/lib/content/index.ts（import.meta.glob，类型安全的 loader）
     │
     ├─→ 页面组件
     └─→ features/search 的索引（构建期生成）
```

### 3.2 PDF 提取：为什么必须自己重建版式

简历 PDF 用 Chromium 打印导出，字体是 **Type3 矢量字形**（`FontFile: 0`）。
这意味着**没有可提取的字符编码** —— 普通解析器拿到的是一串无意义字符。

可行路径是用 pdfjs 的**文本层**：它能给出每个文本块的坐标与字号。
于是提取变成"按几何位置聚类"的问题：

```ts
// scripts/extract-pdf.ts（节选）
const LINE_TOLERANCE = 3; // 同一行的 y 坐标容差（PDF 单位）

// 实测出的版式参数 —— 这些数字来自真实坐标统计，不是猜的
//   区块标题  x=30  size=12.2
//   条目标题  x=30  size=10.8
//   正文      x=43  size=10.8
```

**踩坑记录：换行合并规则改了三次。**

第一版按"缩进更深即为续行"合并 —— 错，因为正文本身缩进就比标题深。
第二版按"上一行过长则合并" —— 也错，因为短句子同样是完整的。

最后是靠**测量真实坐标**才定下来的规则：

> 缩进相同 **且** 上一行末尾没有句末标点 → 判定为续行

这个例子说明：处理真实数据时，"看起来合理"的启发式规则不可靠，
必须先测量再写规则。

**踩坑记录：PDF 里的噪音要显式修正，而不是忍掉。**

提取出的文本有三类问题：

- `Uni \u0000 app` —— 混入了控制字符
- `Fangmu. onlien` —— 原文档里的真实拼写错误
- `。` 前多一个空格

前两类用 `TEXT_CORRECTIONS` 表显式修正；第三类用正则清理。
另外还写了 `findTextAnomalies()` 主动扫描可疑模式 ——
因为**续行规则会掩盖错误**，需要一个独立的检查来发现它们。

> 一个细节：清理控制字符的正则如果直接写字面量会触发 ESLint 的
> `no-control-regex`。做法是用 `new RegExp()` 构造字符类，
> 既满足规则，也让意图更明确。

### 3.3 构建期校验必须放在 Vite 钩子里（重要）

这是本项目最值得记住的一个陷阱。

**Vite 只做静态打包，模块体不在 Node 里执行。**
所以把校验写成模块顶层的 `throw` 完全无效：

```ts
// ❌ 这样写不会让构建失败
if (!schema.safeParse(content).success) {
  throw new Error("内容不合法");
}
```

Vite 会照样把这段代码打进产物 —— 错误只在**浏览器里**抛出，
也就是说：坏内容已经被部署了，用户看到白屏。

正确做法是放进 Vite 插件钩子，在 Node 里执行：

```ts
// vite.config.ts
function contentGuard(): Plugin {
  return {
    name: "content-guard",
    async buildStart() {
      const { validateAllContent } =
        await import("./src/lib/content/validate.ts");
      // ...读取 content/ 并校验
      this.error(message); // this.error 会中断构建
    },
  };
}
```

这个结论是**用实验验证过的**：我先写了一个顶层 `throw` 的模块，
确认 `vite build` 依然成功（exit 0），才确定必须改用钩子。

### 3.4 隐私边界在"哪些文件进入产物"这一层

第一版用条件渲染隐藏手机号：

```tsx
{
  profile.privacy.showPhone && <a href={`tel:${phone}`}>{phone}</a>;
}
```

**这是无效的。** 条件渲染只影响 DOM，`phone` 字符串早已被打进 JS 产物 ——
任何人打开开发者工具搜索就能找到。

根因是 `import.meta.glob('content/**/*.json')` 这种"一把抓"的 glob
把含手机号的 `profile.json` 也打进了产物。

正确的修法是**在构建期生成脱敏副本**，并让 glob 精确到文件：

```ts
// scripts/build-public-content.ts
// 读取 profile.json，按 link.public 过滤，写出 profile-public.json

// src/lib/content/index.ts —— 每个文件单独 glob，不合并
const PUBLIC_ENTRY_MODULES = {
  profile: import.meta.glob("../../../content/profile-public.json", {
    eager: true,
    import: "default",
  }),
  resume: import.meta.glob("../../../content/resume.json", {
    eager: true,
    import: "default",
  }),
  // ...
} as const;
```

于是产物里根本不存在手机号 —— 不是"藏起来了"，是**从未进入**。

代价是新增内容文件时要同步这个映射表。这个显式约束是值得的，
它把"隐私"从"记得别渲染"变成了"结构上不可能泄漏"。

另外还有一层保障：`verify:privacy` 在构建后扫描 `dist/` 下所有文本文件，
从 `profile.json` 里读出私密字段的值，逐个搜索。它**故意不扫描 PDF 二进制**
（PDF 里有手机号是预期行为）。

### 3.5 内容 schema 的组织

```
src/lib/content/schema/
├── primitives.ts    # isoDateSchema、urlSchema、dateRangeSchema、parseWithContext
├── profile.ts       # 个人信息、隐私开关、集成配置、SEO 配置
├── resume.ts        # 教育经历、项目概览、奖项
├── skill.ts         # 技能分组
├── project.ts       # 作品集详情
├── post.ts          # 文章 frontmatter
├── asset.ts         # 公开资产声明
├── page-meta.ts     # 各页面 SEO 文案
├── enum-labels.ts   # 枚举值的展示标签
└── index.ts         # 统一导出
```

两个设计点：

**`parseWithContext` 让报错可定位。** Zod 默认的错误信息不含文件路径，
内容校验失败时你不知道是哪个文件出错。这个包装函数把路径拼进消息：

```ts
export function parseWithContext<T>(
  schema: ZodType<T>,
  value: unknown,
  source: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${source} 校验失败：\n${formatIssues(result.error)}`);
  }
  return result.data;
}
```

**枚举标签单独一个文件。** 数据模型里用英文枚举（`completed` / `active`）
是正确的 —— 它们是**稳定的标识符**，不该随展示语言变化。
但界面上要显示中文，于是有了"把中文标签写进组件"的诱惑。

`enum-labels.json` 就是为了消除这个诱惑：一处定义、全局一致，
改文案不需要动代码。它是在零硬编码守卫扩大到整个 `src/` 之后
被抓出来的问题（当时 `project-card.tsx` 里有一张 `{ completed: { label: '已完成' } }`）。

### 3.6 练习

1. **复现"条件渲染不能保护隐私"**：在某个页面用条件渲染隐藏一个字段，
   运行 `pnpm build`，然后在 `dist/` 里搜那个值。你会搜到它。
2. **验证 Vite 不执行模块体**：新建一个顶层 `throw` 的模块并 import 它，
   运行 `pnpm build`，观察它是否失败。（不会）
3. 给 `content/` 加一个新字段，从 schema 一路加到页面上，
   体会类型推导如何帮你发现遗漏的地方。

---

## 4. TypeScript 严格模式实战

### 4.1 配置

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true, // 索引访问返回 T | undefined
    "exactOptionalPropertyTypes": true, // 可选属性不接受显式 undefined
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
  },
}
```

前四个是本项目额外开启的。下面每条都对应**真实拦下的问题**。

### 4.2 `noUncheckedIndexedAccess`：索引访问可能是 undefined

开启后 `array[0]` 的类型是 `T | undefined`，`record[key]` 也是。

**实际拦下的问题**：`document.getElementById('root')` 返回 `HTMLElement | null`，
迫使我在入口显式判空，而不是用 `!` 断言把风险藏起来：

```ts
const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到 #root 挂载点，请检查 index.html");
}
createRoot(container).render(/* ... */);
```

它还迫使我在处理正则捕获组时写 `match[1] ?? ''` ——
初看啰嗦，但它消除了一整类"正则没匹配上导致 undefined 往下传"的运行时错误。

### 4.3 `exactOptionalPropertyTypes`：最"烦人"也最有价值的一个

它区分**"属性可以缺失"**与**"属性可以是 undefined"**：

```ts
interface Props {
  ref?: Ref<unknown>; // 可以缺失
}
// 但不能显式传 { ref: undefined }
```

**实际拦下的三个问题**：

**问题一：`fetch` 的 `signal` 不接受 undefined。**

```ts
// ❌ Type 'AbortSignal | undefined' is not assignable to type 'AbortSignal | null'
fetch(url, { headers, signal });

// ✅ 显式转换
fetch(url, { headers, signal: signal ?? null });
```

`RequestInit.signal` 的类型是 `AbortSignal | null`，**不含 undefined**。
这个区别在 `exactOptionalPropertyTypes` 下才暴露。

**问题二：motion 的缓动数组被推断成 `number[]`。**

```ts
// ❌ number[] 不能赋给 Easing（需要 4 元组）
export const EASE_OUT = [0.16, 1, 0.3, 1];

// ✅ 显式元组类型
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
```

**问题三：表单蜜罐字段的 `.default('')` 导致类型不匹配。**

Zod 的 `.optional().default('')` 会让**输入类型是 `string | undefined`、
输出类型是 `string`**。两者不一致时 `zodResolver` 的类型对不上。
做法是去掉 `.default()`，空初值由表单的 `defaultValues` 提供 ——
职责也更清楚。

### 4.4 `verbatimModuleSyntax`：类型导入必须显式标注

它要求类型导入写 `import type`，否则运行时可能产生空导入。
配合 ESLint 的 `consistent-type-imports` 规则，可以自动修复。

好处不只是"更规范"：它让**类型依赖与运行时依赖在源码层面就是可区分的**，
打包器也更容易做 tree-shaking。

### 4.5 类型定义与运行时校验的同源

Zod 的最大价值不是"能校验"，而是**类型从 schema 推导出来**：

```ts
const projectSchema = z.object({/* ... */});
export type Project = z.infer<typeof projectSchema>;
```

于是不可能出现"类型说有三个字段、校验只看两个"这种漂移。
手写 interface + 单独的校验函数迟早会分叉。

**注意这里的边界**：这个价值只在构建期成立。
一旦把 Zod 放进运行时（浏览器），你就为"类型同源"付出了包体积的代价 ——
所以 [2.2 节](#22-刻意不采用的技术这部分同样重要)里那条回退是必要的。

### 4.6 练习

1. 关掉 `noUncheckedIndexedAccess`，看 `pnpm typecheck` 有多少错误消失 ——
   然后逐个检查那些位置是否真的安全。
2. 写一个 `exactOptionalPropertyTypes` 会报错、关掉就通过的例子，
   理解它保护的是什么。
3. 给一个现有的 schema 加 `refine()` 做跨字段校验（比如"结束日期不能早于开始日期"），
   观察类型推导是否仍然正确。

---

## 5. React 19 实战

### 5.1 不再需要 `forwardRef`

React 19 起 `ref` 是**普通 prop**：

```tsx
// React 18：必须包一层
const Button = forwardRef<HTMLButtonElement, Props>((props, ref) => (
  <button ref={ref} {...props} />
));

// React 19：ref 就是普通 prop
function Button({ ref, ...props }: Props & { ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />;
}
```

`forwardRef` 在 React 19 里仍可用但已不必要。少一层包装意味着
props 类型更直观，也不必再处理 displayName。

### 5.2 原生 metadata 提升 —— 以及它的两个陷阱

React 19 可以把组件里渲染的 `<title>` / `<meta>` / `<link>` 提升到 `<head>`。
这让 `react-helmet-async` 变得多余。但有两个陷阱，都是我在真实浏览器里撞上的。

**陷阱一：`<script>` 不会被提升。**

JSON-LD 结构化数据用的是 `<script type="application/ld+json">`，
React **不会**把它提升到 head —— 它留在 `<body>` 里。
虽然 Google 能读取 body 里的 JSON-LD，但校验工具建议放 head。

修法是改用命令式插入：

```tsx
function StructuredData({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data);

  useLayoutEffect(() => {
    const head = document.head;
    // 先清掉本组件此前插入的，避免路由切换时累积
    for (const old of head.querySelectorAll(
      'script[type="application/ld+json"][data-seo-managed]',
    )) {
      old.remove();
    }
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-managed", "");
    script.textContent = json;
    head.appendChild(script);
  }, [json]);

  return null;
}
```

**陷阱二（严重）：模板里已有的同名标签会与提升的标签并存。**

`index.html` 里有默认的 `<title>` 和 `<meta name="description">`
（为了不执行 JavaScript 的爬虫）。React 会把新标签**追加**到 head，
而模板里那两个留在原地 —— 形成重复。

后果比"多一行"严重得多：`document.title`、`querySelector` 与爬虫
**都取第一个**，所以每个页面的标签页标题都是模板那句静态文案，
每页描述都退回通用描述。**页面级元数据完全失效。**

我加了一个"删掉除最后一个之外全部"的 effect 来修 ——
**结果破坏了整个客户端路由**：

```
TypeError: Cannot read properties of null (reading 'removeChild')
```

症状是 URL 变了但页面内容不换，看起来像"点导航没反应"。

根因：路由切换时 React 要卸载上一次渲染的节点，
而那个节点已经被我的 effect 删掉了 —— React 拿到 `null` 就抛错，
整棵树的提交被中断。

正确的修法有两点：

```tsx
useLayoutEffect(() => {
  // 1. 标题用命令式赋值，React 完全不碰 <title>
  document.title = fullTitle;

  // 2. 只删除**没有标记**的模板标签，绝不触碰 React 创建的节点
  for (const stale of document.head.querySelectorAll(
    'meta[name="description"]:not([data-seo-managed])',
  )) {
    stale.remove();
  }
}, [fullTitle]);

return (
  <>
    <meta
      key="description"
      data-seo-managed=""
      name="description"
      content={description}
    />
    {/* ... */}
  </>
);
```

**这个 bug 单测与构建检查都发现不了** —— 只有真实浏览器渲染后才看得出来。
它是"必须做真机验证"这个结论最有力的证据。

### 5.3 状态归属：URL、局部、还是全局？

本站的规则很明确，按**可寻址性**决定：

| 状态           | 放在哪                               | 理由                                 |
| -------------- | ------------------------------------ | ------------------------------------ |
| 标签筛选       | **URL**（`useSearchParams`） | 需要可分享链接、刷新保持、浏览器后退 |
| 主题           | Zustand + localStorage               | 无法用 URL 表达，且被多处消费        |
| 搜索面板开合   | Zustand                              | 同上                                 |
| 移动端抽屉开合 | 局部 `useState`                    | 只有一个消费者                       |
| 表单字段       | React Hook Form 内部                 | 表单库自己管理                       |

**为什么筛选状态一定要放 URL**：它有"可分享链接"这个硬需求。
如果只放在客户端 store 里，就得自己实现 history 同步，
而且很容易和浏览器的前进后退打架（典型症状：按后退键筛选没跟着变）。

用 URL 作为唯一状态源之后，"点标签筛选"与"直接打开带参数的链接"
走的是**同一条代码路径**，不存在"分享出去的链接打开后筛选丢了"这类问题。

一个细节：切换标签时用 `{ replace: true }` 而不是默认的 `push`。
否则每点一次标签就多一条历史记录，用户连点五次后要按五次后退才能离开。

### 5.4 用 `key` 重置组件状态

移动端抽屉需要在路由变化时自动收起。第一版用 effect 监听 `pathname` 再 `setState` ——
被 ESLint 的 `react-hooks/set-state-in-effect` 拦下（在 effect 里同步 setState
会触发级联渲染）。

更好的做法是**用 `key` 让组件重新挂载**：

```tsx
<MobileNav key={location.pathname} className="md:hidden" />
```

路径变化 → key 变化 → 组件重新挂载 → 状态自然回到初始值。
不需要任何 effect，也没有级联渲染。

这个模式适用于"某组状态应该在某个外部条件变化时完全重置"的场景。

### 5.5 用"派生值"代替"在 effect 里同步状态"

PDF 预览组件一开始是：

```tsx
const [error, setError] = useState<string | null>(null);
useEffect(() => {
  if (!pdfModule) setError("引擎未加载");
}, [pdfModule]); // ❌ set-state-in-effect
```

改成从已有状态**派生**：

```tsx
const errorReason = !pdfModule ? "引擎未加载" : pdfError; // ✅ 纯计算
```

判据：如果某个值完全由已有状态决定，就不该是独立 state ——
它引入了一个可能与来源不一致的副本。

### 5.6 练习

1. 打开任何一个页面的开发者工具，检查 `<head>` 里
   `meta[name="description"]` 有几条。想想如果没有 `data-seo-managed` 标记会怎样。
2. 把 `MobileNav` 的 `key` 去掉，改成 effect 同步，观察 ESLint 报错与行为差异。
3. 找一个项目里"被 effect 同步的状态"，看它能否改成派生值。

---

## 6. 样式与主题系统

### 6.1 Tailwind v4 与设计令牌

Tailwind v4 用 CSS 声明配置（不再需要 `tailwind.config.js`）：

```css
/* src/styles/index.css */
@import "tailwindcss";

/* 暗色模式用 class 策略，而不是媒体查询 —— 因为要支持"用户手动选择" */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-500: oklch(0.62 0.19 275);
  /* ...完整品牌色阶 */
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

`@theme` 里定义的变量会自动生成对应的工具类（`bg-brand-500` 等），
同时也可以作为 CSS 变量直接用。

### 6.2 主题为什么不能等 React 挂载后再切

如果把主题设置放在 React 组件里，用户在暗色模式下打开页面会看到：

1. 浏览器用默认（浅色）样式绘制第一帧 —— **白屏闪烁**
2. React 挂载，读到 localStorage，加上 `.dark`
3. 页面变暗

所以要有一段**阻塞式内联脚本**，在首次绘制之前就把类名定好：

```html
<!-- index.html -->
<script>
  (function () {
    try {
      var stored = localStorage.getItem("resume-site-theme");
      var prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      var isDark =
        stored === "dark" ||
        ((stored === null || stored === "system") && prefersDark);
      document.documentElement.classList.toggle("dark", isDark);
    } catch (e) {
      /* 主题引导失败时保持浅色，不影响页面可用性 */
    }
  })();
</script>
```

三个细节：

- **必须是阻塞式**（不能 `defer` / `async` / `type=module`），否则时机就晚了；
- **写成 ES5 风格并包 try/catch** —— 主题引导不能因任何异常阻塞整页渲染；
- **与 Zustand store 里的常量同源**（`THEME_STORAGE_KEY`），避免拼写分叉。

**这个行为是可以用 E2E 验证的**，而且验证方式值得一学：
注入一个 `MutationObserver` 记录 `<html>` 的 class 变化历史，
断言"从未出现过没有 dark 类的状态"。

```ts
test("首屏不闪白（引导脚本在绘制前生效）", async ({ page }) => {
  await page.goto("");
  await page.evaluate(() => localStorage.setItem("resume-site-theme", "dark"));

  await page.addInitScript(() => {
    const history: string[] = [];
    const record = () => history.push(document.documentElement.className);
    document.addEventListener("readystatechange", record);
    new MutationObserver(record).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    (window as any).__classHistory = history;
  });

  await page.reload();
  const history = await page.evaluate(() => (window as any).__classHistory);
  // 曾经出现过没有 dark 类的 html 就意味着闪烁
  expect(history.filter((c) => !c.includes("dark"))).toEqual([]);
});
```

### 6.3 MDX 里不能出现内联 `style`（一个具体的技术约束）

代码高亮用 `rehype-pretty-code` + Shiki 双主题。
Shiki 默认输出内联样式：

```html
<span style="--shiki-light:#24292e;--shiki-dark:#e1e4e8">const</span>
```

而 **MDX 的编译器会拒绝 `style` 属性**：

```
Could not parse 'style' attribute on 'span'
```

（fragment 语法不支持任意 HTML 属性。）

修法是加一个 rehype 插件把 CSS 变量搬成 `data-*` 属性：

```ts
// src/lib/rehype-shiki-data-attributes.ts
// --shiki-light → dataLightColor
// --shiki-dark  → dataDarkColor
// 然后删掉所有 style 属性
```

配合 CSS 里用属性选择器读这两个值，主题切换依然生效：

```css
[data-rehype-pretty-code-figure] span {
  color: var(--shiki-light);
}
.dark [data-rehype-pretty-code-figure] span {
  color: var(--shiki-dark);
}
```

**插件顺序很重要**：这个搬运器必须排在 `rehype-pretty-code` **之后** ——
它得等颜色写进 `style` 之后再处理。

### 6.4 练习

1. 在 MDX 里写一个带 `style` 属性的 `<span>`，运行 `pnpm build` 看报错。
2. 把主题引导脚本改成 `defer`，运行那条"首屏不闪白"的 E2E 用例，
   观察它如何失败。
3. 在 `@theme` 里加一个新颜色，直接用它的工具类，验证自动生成生效。

---

## 7. 路由与数据加载

### 7.1 用 loader 而不是在组件里取数据

React Router 的**数据路由**允许在渲染前把数据准备好：

```ts
// features/projects/project-detail-loader.ts
export function projectDetailLoader({ params }) {
  const slug = params["slug"];
  if (slug === undefined) {
    throw new Response("缺少项目标识", { status: 400 });
  }

  const project = getProjectBySlug(slug);
  if (project === undefined) {
    throw new Response(`找不到项目「${slug}」`, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return { project, related: findRelatedProjects(project) };
}
```

两个好处：

1. **数据在渲染前就绪**，组件里不需要 `if (!project)` 分支，
   类型上也不必处理"可能还没加载"；
2. **找不到数据时直接 `throw new Response`**，由根路由的错误边界统一渲染 ——
   错误传播是数据路由的核心价值，不用在每个组件里重复写。

**这个设计救了我一次**：错误边界一开始显示的是 `${status} ${statusText}`，
于是拼错的项目 slug 显示成「404 Not Found」—— **对用户毫无用处**。
而 loader 抛出的那句中文消息在 **body**（`error.data`）里，
`statusText` 只是 HTTP 状态短语。

修法是优先显示 body：

```ts
if (isRouteErrorResponse(error)) {
  const data: unknown = error.data;
  if (typeof data === "string" && data.trim() !== "") return data;
  return `${String(error.status)} ${error.statusText}`;
}
```

真实浏览器验证才暴露出这一点 —— 单测与构建检查都发现不了
"给用户看的文案拿错了字段"。

### 7.2 懒加载与分包

每个页面都是独立的 chunk：

```ts
// src/app/router.tsx
{
  path: 'about',
  lazy: async () => ({ Component: (await import('@/pages/about')).default }),
  errorElement: <RouteErrorBoundary />,
}
```

`manualChunks` 把第三方库拆成稳定的、可单独缓存的 chunk：

```ts
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  'vendor-router': ['react-router'],
  'vendor-motion': ['motion'],
  'vendor-state': ['zustand'],
  'vendor-query': ['@tanstack/react-query'],
}
```

**踩坑：`manualChunks` 必须列出每个入口，不能只写包名。**

只写 `'react': ['react']` 时，`react-dom/client` 与 `react/jsx-runtime`
不在规则内，会静默落回主 chunk —— 实测 `vendor-react` 只有 4 KB。

**另一个坑：`manualChunks` 不是 tree-shaking。**
它只做模块搬迁，不减小总体积。真正的体积优化来自"不引入那段代码"
（见 [2.2 节](#22-刻意不采用的技术这部分同样重要)的 Zod 案例）。

实测分包结果：

| chunk             | 体积   | 何时加载                    |
| ----------------- | ------ | --------------------------- |
| `pdf`           | 427 KB | 点"预览简历"时（懒加载）    |
| `vendor-react`  | 208 KB | 首屏                        |
| `contact`       | 119 KB | 进联系页（含 Zod + 表单库） |
| `vendor-router` | 98 KB  | 首屏                        |
| `vendor-motion` | 95 KB  | 按需                        |
| `index`         | 94 KB  | 首屏                        |
| `vendor-query`  | 33 KB  | 进"开源仓库"区块            |
| `search-dialog` | 31 KB  | 按 ⌘K 时                   |

### 7.3 `modulePreload` 会把懒加载优化抵消掉

Vite 默认会为入口**间接可达**的所有 chunk 注入 `<link rel="modulepreload">` ——
包括只在懒加载分支里用到的。

实测：`vendor-query`（只有"开源仓库"区块需要）也被写进了 `index.html`，
等于首屏就下载它。修法是过滤：

```ts
build: {
  modulePreload: {
    resolveDependencies: (_filename, deps) =>
      deps.filter((dep) => !dep.includes('vendor-query') && !dep.includes('vendor-motion')),
  },
}
```

改完首屏预加载从 5 个减到 3 个（`vendor-react` / `vendor-router` / `vendor-state`）。

**由此还发现一个架构问题**：`QueryClientProvider` 挂在应用根部时，
TanStack Query 会进入主包 —— 实测主 chunk 从 91 KB 涨到 205 KB，
而全站只有一个区块用它。把 Provider 移进那个区块自己的懒加载边界后，
主包回落到 94 KB。代价是那**段边界必须自包含** ——
一旦别的页面也用 Query，优化立刻失效。

### 7.4 部署前缀：两处必须同源

```ts
// src/app/router.tsx
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");
export const router = createBrowserRouter(routes, { basename });
```

`import.meta.env.BASE_URL` 由 Vite 从 `base` 配置注入，所以
**路由的 basename 与资源前缀不可能分叉**。这比手写两遍 `/resume` 可靠得多。

`verify:build` 会在构建后检查产物里的 basename 字面量是否与资源前缀一致。

自定义域名部署时前缀变成 `/`，这个推导会自动跟上 ——
详见 [第 9 章](#9-工程守卫与交付)。

### 7.5 练习

1. 把 `projectDetailLoader` 的 `throw new Response` 改成返回 `null`，
   然后在组件里处理 —— 体会代码量的增加。
2. 去掉一条路由的 `lazy`，看主包体积变化。
3. 在 `modulePreload.resolveDependencies` 里再加一个过滤条件，
   观察 `dist/index.html` 的 preload 列表。

---

## 8. 测试策略

### 8.1 三层分工

| 层   | 工具               | 负责什么               | 数量         |
| ---- | ------------------ | ---------------------- | ------------ |
| 单元 | Vitest             | 纯逻辑与数据边界       | 108          |
| 组件 | Vitest + RTL + MSW | 渲染分支与状态         | （含在上面） |
| E2E  | Playwright         | 布局、浏览器 API、交互 | 146          |

**分工的判据是"谁验证更划算"**，不是"覆盖率越高越好"：

- 筛选逻辑、URL 参数解析、表单校验规则、错误分类 → 单测（快、精确）
- 数据取到了渲染成什么样 → 组件测试
- 布局是否溢出、localStorage 是否持久化、键盘导航是否可用 → E2E
- 构建期专用代码（Zod schema、内容加载器）→ **守卫脚本**，不是单测

最后一类值得展开：内容 schema 的正确性用 `pnpm validate` 在**真实内容**上验证，
比构造一堆测试夹具更有说服力。

### 8.2 覆盖率：范围比数字重要

第一版一刀切设 70%，实测只有 **24.79%** —— 因为大块代码是构建期专用的，
它们根本不进浏览器产物，也不该由单测负责。

按三类理由明确排除后，覆盖率 **87.26%**，阈值提到 85%。这个数字才有指导价值：

| 被排除的类别   | 例子                                | 由谁验证                 |
| -------------- | ----------------------------------- | ------------------------ |
| 构建期专用     | Zod schema、内容加载器、rehype 插件 | `pnpm validate` 等守卫 |
| 布局组合       | 页面、站点外壳、UI 基座             | Playwright E2E           |
| 依赖浏览器 API | 主题 store、搜索面板、PDF 预览      | Playwright E2E           |

**教训：阈值本身不是目标，它只在范围清楚时才有意义。**
设太高的后果是逼人写无意义的测试来凑数，反而降低测试价值。

### 8.3 陷阱一：jsdom 不实现 `IntersectionObserver`

motion 的 `whileInView` 依赖它。缺失时的症状**极具误导性**：

```
query 状态 = success，data 正确
但组件内容一个都不渲染
```

看起来像"数据取到了但渲染逻辑有问题"，实际是
`<ForwardRef(motion.div)>` 渲染时抛 `ReferenceError: IntersectionObserver is not defined`，
组件在渲染阶段就崩了。

修法是在 setup 里补一个会**立即报告"进入视口"**的 stub：

```ts
class ImmediateIntersectionObserver implements IntersectionObserver {
  observe(target: Element): void {
    queueMicrotask(() => {
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target /* ... */ }],
        this,
      );
    });
  }
  // unobserve / disconnect / takeRecords ...
}
```

用 `queueMicrotask` 而不是同步执行，是为了模拟真实 API 的异步行为。

**代价要说清**：这意味着单测里**测不到"滚动才出现"这个行为本身**。
那属于视觉行为，由 E2E 在真实浏览器里覆盖。

### 8.4 陷阱二：jsdom 与 Node 的 realm 冲突

这是最费解的一个。症状是"**裸 fetch 正常、组件内必然失败**"：

```
TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
```

排查过程：

1. 裸 `fetch` 走 MSW **完全正常**（status=200，JSON 正确）；
2. 但组件里必然失败，错误是我自己抛的"网络请求失败"；
3. 差别在于 **TanStack Query 会给 queryFn 传 `AbortSignal`**，而直接调用 API 时通常不传；
4. `fetch.name === 'fetchProxy'` —— Vitest 的 jsdom 环境**代理包装了 fetch**，
   那个代理用**自己 realm** 的 `AbortSignal` 做 `instanceof` 校验。

**试过但无效**：把 Node 的 `AbortSignal` / `AbortController` 覆盖到全局。
覆盖后 `signal instanceof globalThis.AbortSignal` 为 `true`、原型链也一致，
但 `Request` **仍然拒绝** —— 说明校验用的构造器既不是全局那个，
也不是 jsdom 那个，而是代理内部的私有引用。

最终接受**有界妥协**：测试环境里包一层 fetch，剥掉 signal。

```ts
function installFetchWithoutSignal(): void {
  const current = globalThis.fetch;
  if (current.name === "fetchWithoutSignal") return; // 幂等

  const wrapped: typeof fetch = (input, init) => {
    if (init?.signal == null) return current(input, init);
    const { signal: _signal, ...rest } = init;
    return current(input, rest);
  };
  globalThis.fetch = wrapped;
}

// 必须在 beforeEach 里安装
beforeEach(() => {
  installFetchWithoutSignal();
});
```

**为什么必须在 `beforeEach` 里装**：setup 文件执行完之后，Vitest 会
**再次重置测试环境**，`fetch` 被换回 `fetchProxy` —— 模块顶层那次包装等于白做。
症状是"包装代码明明写了却不生效"，很容易误判成包装写法有问题。

这个妥协的边界是明确的：请求路径（URL、方法、请求头、状态码处理）
全部照常被验证，**只损失了"取消请求"这一个测试点**。
而生产环境里浏览器只有一份 DOM 实现，不存在 realm 冲突。

### 8.5 MSW：在网络层 mock，而不是 mock fetch

```ts
// src/test/msw-handlers.ts
export function githubHandlers(options = {}) {
  return [
    http.get('https://api.github.com/users/:username/repos', () => {
      if (options.notFound) return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
      if (options.rateLimited) return HttpResponse.json(/* ... */, { status: 403, headers: {...} });
      // ...
    }),
  ];
}
```

**为什么不在测试里 mock `fetch` 本身**：那会替换实现细节 ——
组件换了请求方式就要重写测试，而且**测不到 URL、请求头、状态码处理**。
MSW 拦截在网络层，组件代码完全不知道 mock 存在，测的是真实请求路径。

实测价值：有一条用例专门断言请求 URL 含 `per_page=100` ——
如果 mock 的是 fetch，这个断言根本无从写起。

另一个关键配置：

```ts
server.listen({ onUnhandledRequest: "error" });
```

默认行为是"警告并放行"，于是没被 mock 的请求会**真的发出去** ——
测试看起来通过了，实际上依赖了真实网络（慢、不稳定、可能消耗第三方额度）。
设成 `error` 会在第一个未 mock 的请求上直接失败。

### 8.6 E2E 的三个环境坑

**坑一：`vite preview` 默认 `base` 是 `/`。**

产物里的资源路径是 `/resume/assets/...`，而 preview 默认在根下找 `/assets/...`，
于是**每个 JS 都 404、页面完全空白**。必须显式传参：

```ts
webServer: {
  command: `npx vite preview --port 4173 --strictPort --base ${BASE_PATH}`,
}
```

这个坑很隐蔽：`vite build` 成功、`verify-build` 也通过
（它检查的是产物文件里的路径），但用 preview 打开就是白屏。

**坑二：地址要用 `localhost` 而不是 `127.0.0.1`。**

`vite preview` 不加 `--host` 时**只绑定 IPv6 回环（`::1`）**，
而 `127.0.0.1` 是 IPv4。写成后者会得到"无法连接到远程服务器"，
看起来像"服务器没起来"，实际是地址族不匹配。

> 这个坑在本项目的开发阶段一直被误判为"沙箱不允许监听端口"，
> 导致欠了三轮的真机验证。

**坑三：浏览器来源。**

开发环境下载不了 Playwright 的浏览器二进制，
但系统 Chrome 本来就在。用 `channel: 'chrome'` 直接驱动它：

```ts
const browserOptions =
  process.env["E2E_BROWSER"] === "chromium"
    ? {}
    : { channel: "chrome" as const };
```

CI 上会执行 `playwright install --with-deps chromium` 并设 `E2E_BROWSER=chromium`。
两种方式验证同一批断言，差别只在浏览器来源。

### 8.7 我在测试数据上连续错了四次

"无匹配结果"的用例，我依次挑了 `Vue`+`HTML`、`Vue`+`医疗`、`Uni-app`+`Vue` ——
**全都恰好同时存在于某个项目上**。

第三次我甚至怀疑 AND 筛选有 bug，查了 store、纯函数、构建产物，
最后把标签的**字符码**打出来对比，才确认代码完全正确、是我的数据假设错了。

第四次是断言写法：

```ts
// ❌ 同时命中按钮**和按钮祖先 div 的纯文本** → 严格模式报错
await expect(page.getByText("清除筛选", { exact: true })).toBeVisible();

// ✅ 用 role 定位 + first()（页面上确实有两个合理的"清除筛选"按钮）
await expect(
  page.getByRole("button", { name: "清除筛选" }).first(),
).toBeVisible();
```

两条教训写进了用例注释：

1. **用测试数据前先确认它真的满足前提**（别凭直觉挑标签）；
2. **定位元素用角色 + 名称，不要用纯文本** —— 祖先元素会带着同样的文字。

### 8.8 测试抓到的真实缺陷

测试不只是"防止回归"，它确实找出了产品缺陷：

| 缺陷                                   | 症状                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| 限流时仍显示"重新加载"按钮             | 条件只排除了 `invalid-response`，漏了 `rate-limited` —— 而限流时重试会消耗更多额度 |
| 搜索方向键跳项                         | `(index + 1) % length` 在未选中时按一次下箭头跳到**第二项**                      |
| AND 筛选是没有入口的死代码             | `filterProjects` 支持 `'all'`，但 store 只暴露 OR                                    |
| 错误页显示 `statusText` 而非消息正文 | loader 的中文消息被显示成「404 Not Found」                                               |

第三条特别值得记住：**一段实现了却没有入口的代码，等于没写。**
它是写 E2E 时才被发现的。

### 8.9 练习

1. 把 `onUnhandledRequest` 改成 `'warn'`，观察测试是否仍然通过 ——
   然后想想为什么这个"通过"是危险的。
2. 给 `github-api.test.ts` 加一条用例，断言请求头里的
   `Accept` 含 `application/vnd.github+json`。
3. 在某个 E2E 用例里把 `localhost` 改回 `127.0.0.1`，观察失败方式。

---

## 9. 工程守卫与交付

### 9.1 为什么需要守卫脚本

这个项目里有大量"**错了也不会报错**"的东西：

- sitemap 少一条 URL → 那篇文章很久不被收录，没有任何提示
- canonical 指向旧域名 → 静默掉排名
- base 前缀配置错误 → 只在线上白屏
- 路由 HTML 入口漏生成 → 只有访客刷新深层页面时才 404
- 文案硬编码在组件里 → 内容管道形同虚设
- 私密字段打进产物 → 谁都看不见

**这类问题的共同点是：唯一能发现它们的方式就是主动去检查。**
所以本项目有 7 个守卫，每个都在构建后或检查时运行。

### 9.2 七个守卫各自防什么

| 脚本                                     | 防什么                                          | 怎么防                          |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `validate`                             | 内容不符合 schema、占位符未清理                 | 对真实内容跑 Zod                |
| `verify:content`                       | 页面文案硬编码在组件里                          | 从内容提取事实串，反查源码      |
| `verify:build`                         | base 前缀丢失、分块缺失、动态导入写错           | 从产物**反推**前缀再自检  |
| `verify:privacy`                       | 私密字段泄漏进产物                              | 从源头读值，扫遍 `dist/` 文本 |
| `verify:search`                        | 搜索索引漏页、跳转目标无效                      | 数据层不变量检查                |
| `verify:seo`                           | sitemap 缺页、manifest scope 不符、路由入口缺失 | 对照内容数据逐项核对            |
| `verify:routes`（并入 `verify:seo`） | 每路由 HTML 入口、404 回退                      | 按内容数据核对文件存在性        |

### 9.3 三种值得学的守卫写法

**写法一：从产物反推，而不是写死。**

`verify-build` 原本写死了 `const REPO_NAME = 'resume'` ——
这是同一份部署事实的**第三处**副本。改成从 `index.html` 里反推：

```ts
const entryMatch = /src="([^"]*?)assets\/(index-[^"]+\.js)"/.exec(html);
const derivedBase = entryMatch?.[1] ?? ""; // "/resume/" 或 "/"
const routerBasename = derivedBase.replace(/\/+$/, ""); // "/resume" 或 ""
```

于是无论部署在 `/` 还是 `/resume/`，检查都成立 ——
**产物就是唯一真相，脚本只检查"内部是否自洽"。**

**写法二：按字段名排除，而不是按值白名单。**

零硬编码守卫需要放行一些东西。做法是排除**字段名**：

```ts
const IGNORED_FIELDS = new Set(["file", "status"]);
```

理由：`file` 是公开资产的 URL 片段（组件必须按名字引用），
`status` 是枚举标识符（要做类型化查表）。
**前者表达"这一类字段不是展示文案"，后者会随着新内容慢慢变成一张废纸。**

`enum-labels.json` 是个特例：它的**键**是枚举标识符（必须写在源码里才能查表），
**值**是中文标签（照常受检查）。所以整个文件被排除 ——
但这一点在注释里写明了，因为它是该文件**唯一的职责**。

**写法三：用一个故意改坏的文件验证守卫真的会失败。**

写完 `verify:seo` 后，我把 `dist/index.html` 里的 meta description 改成一句错话，
确认脚本 **exit 1 并给出差异对比**，然后才重新构建。

**没有这一步，你不知道守卫是真在工作，还是在永远返回成功。**
守卫给出虚假的安全感，比没有守卫更危险。

### 9.4 守卫范围过窄比没有守卫更危险

零硬编码守卫第一版只扫 `src/pages` 与 `src/components` ——
因为当时文案只写在那两处。

写 SEO 组件时我把中文文案放进了 `src/lib/seo/`，**它逃过了检查**。

扩大到整个 `src/` 之后立刻抓出了
`project-card.tsx` 里的 `{ completed: { label: '已完成' } }` 映射表。

**教训**：一个"只覆盖部分目录"的守卫会让人误以为已经被保护了。
范围要么明确说清，要么就别留缺口。

### 9.5 部署：一个变量决定两件事

GitHub Pages 有两种形态，**路径前缀不同**：

| 形态             | 站点地址                                | 资源前缀     |
| ---------------- | --------------------------------------- | ------------ |
| 项目站点（默认） | `https://fangmuyang.github.io/resume` | `/resume/` |
| 自定义域名       | `https://fangmu.online`               | `/`        |

自定义域名时前缀**必须**是 `/` —— 域名的根就是站点根，
没有 `/resume/` 那一段。继续用子路径会让所有资源 404、整站白屏。

而"站点地址"与"资源前缀"必须**同时**改变，否则 canonical 指向一个
资源加载不出来的地址。所以它们由**同一个变量**推导：

```ts
// src/lib/seo/site-config.ts
export function deriveSiteConfig(siteUrl: string): DerivedSiteConfig {
  const origin = siteUrl.trim().replace(/\/+$/, "");
  const pathOnly = origin.replace(/^https?:\/\//, "").split(/[?#]/)[0];
  const firstSlash = pathOnly.indexOf("/");
  const basePath =
    firstSlash === -1 ? "" : pathOnly.slice(firstSlash).replace(/\/+$/, "");

  return {
    origin,
    basePath,
    basePrefix: basePath === "" ? "/" : `${basePath}/`,
  };
}
```

```bash
pnpm build                                      # 项目站点
VITE_SITE_URL=https://fangmu.online pnpm build  # 自定义域名
```

**这个推导我算错过多次**，最后靠 17 个单测固定下来：

- 第一次把它与 `BASE_PREFIX` 拼了两次 → `…/resume/resume/`
- 而**构建不报错**，只有真去看 sitemap 内容才发现
- 排查时又在临时命令里把正则的 `$` 误写成 `\$`，导致替换静默失效

根因是 `build-seo.ts` 里维护了一份**独立的**重复实现，两份分了叉。
改为复用同一个函数后就没有这个空间了。

### 9.6 一个 CI 上的真实边缘：空字符串不等于"未设置"

GitHub Actions 的 `${{ vars.SITE_URL }}` 在变量未配置时展开为**空字符串**，
而不是不传这个变量。

```ts
// ❌ 空字符串会被当成有效值 → base 变成 "/" → 部署到项目站点后整站白屏
const url = import.meta.env.VITE_SITE_URL ?? DEFAULT;

// ✅ 空字符串也算未设置
const value = import.meta.env.VITE_SITE_URL;
const url =
  typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT;
```

这个分支已在本地用 `VITE_SITE_URL=''` 实测过会正确回退。

### 9.7 CI 与部署的设计

**CI 分两个并行 job**：`verify`（约 1 分钟）与 `e2e`（约 3 分钟）。
分开的理由是校验失败能立刻给反馈，而并行时总时长由慢的决定、不会叠加。
`e2e` 仍然 `needs: verify` —— 校验都过不了时再跑 E2E 没有意义。

**部署用官方的 `upload-pages-artifact` + `deploy-pages`**，不用 `gh-pages` 分支：
后者需要仓库写权限、会污染提交历史、每次部署产生一个二进制提交。
产物作为 workflow artifact 上传后由 Pages 服务直接发布，回滚就是在
Actions 里重跑历史部署。

**`--frozen-lockfile` 不能省。** 默认行为是"锁文件与 package.json 不一致时
自动更新锁文件"，在 CI 上这意味着**依赖可能与你本地不同**，构建结果就不可复现了。

### 9.8 SPA 在静态托管上的两个限制（必须说清）

**限制一：未枚举的路径返回 HTTP 404。**

`build-prerender.ts` 为每个应可直达的路径复制一份 HTML 入口
（静态页 + 项目详情 + 文章详情，共 12 个），所以**枚举到的**路由都返回 200。
但拼错的地址只能走 `404.html` 兜底，而 GitHub Pages 返回的**状态码仍是 404** ——
静态托管没有服务端重写，绕不过去。

> 顺带一个反直觉的发现：`vite preview` 对未命中路径返回 **200**
> （它自带 history-fallback），与 GitHub Pages 不同。
> 所以 E2E 里那条用例只断言"应用能接管"，**不断言状态码** ——
> 因为状态码取决于托管实现，不是本项目能控制的。

**限制二：页面内容由 JavaScript 渲染，不是预渲染。**

那些 HTML 入口**只有壳**：

- **执行 JavaScript 的爬虫**（Google、Bing）能拿到完整内容与每页元数据；
- **不执行 JavaScript 的爬虫**（多数社交平台预览抓取器）
  只会看到 `index.html` 里的默认 title/description。

所以分享出去的链接，预览卡片是**通用描述**，而不是当页的。

彻底解决需要预渲染或 SSR（Next.js / Astro），属于架构变更，超出本项目范围。
`index.html` 里的默认标签因此**刻意与首页保持一致**，让降级结果不至于是错的，
并由 `verify:seo` 在构建后核对两者是否同步。

### 9.9 验收状态（不掩饰未做的事）

| 项                              | 状态                  | 依据                                                  |
| ------------------------------- | --------------------- | ----------------------------------------------------- |
| 类型安全、构建通过              | ✅                    | `pnpm check` / `pnpm build` 全绿                  |
| 测试与 Lint 通过                | ✅                    | 108 单测 + 146 E2E + ESLint 零警告                    |
| 移动端友好                      | ✅                    | E2E 移动端 project：无横向滚动、抽屉交互、触摸参数    |
| 每项技术都有落地点              | ✅                    | [第 2 章](#2-技术选型有取有舍)的表格逐条对应代码位置   |
| PWA 可安装                      | ✅                    | E2E 断言 manifest 合法、service worker 已激活         |
| **Lighthouse 四维 ≥ 90** | ⚠️ **未测**   | 环境无法运行 Lighthouse。不能声称达标                 |
| **CI 真实跑通**           | ⚠️ **未验证** | 配置已完成，但本地无远端仓库，从未在 GitHub 上执行过  |
| **部署真实成功**          | ⚠️ **未验证** | 同上。E2E 跑在 `vite preview` 上，不是 GitHub Pages |
| 27 处 `TODO:` 占位            | ⚠️ **待补**   | 需要作者补充简介、城市、项目截图与技术标签            |

**为什么要把这些列出来**：一份学习文档如果对未验证的部分含糊其辞，
读者就无法判断哪些结论有实测支撑。
上面每一项的"依据"列就是告诉你——**这条结论是怎么来的**。

### 9.10 练习

1. **验证守卫真的会失败**：改坏 `dist/index.html` 里的一句话，
   跑 `pnpm verify:seo`，确认它 exit 1 并指出具体差异。
2. **给守卫加一个新检查**：比如"所有 `<img>` 都有 `alt`"
   （提示：扫 `dist/` 里的 HTML 与 JSX 源码各有取舍）。
3. **用自定义域名的形态完整验证一遍**：
   `VITE_SITE_URL=https://example.com pnpm build`，
   检查 `dist/sitemap.xml`、`dist/manifest.webmanifest`
   与 `dist/index.html` 里的前缀是否都变成了 `/`。

---

## 附录：这一路踩过的坑，按类型归拢

把散在各章的问题按**根因类型**重新归类 —— 这样更容易迁移到别的项目。

### A. 配置分叉（同一事实写在多处）

| 问题                                                | 修法                                          |
| --------------------------------------------------- | --------------------------------------------- |
| `base` 与 `basename` 各写一遍                   | basename 从 `import.meta.env.BASE_URL` 推导 |
| 仓库名写了三处（vite / site-config / verify-build） | 单点定义 + 产物反推                           |
| sitemap 的 URL 拼接有两份实现                       | 复用 `toAbsoluteUrl`                        |
| `THEME_STORAGE_KEY` 在脚本与 store 各一份         | 共享常量                                      |

**规律**：同一份事实有两份副本，它们迟早会分叉，而分叉通常**不报错**。

### B. "看起来对"但实际无效

| 问题                                        | 真相                            |
| ------------------------------------------- | ------------------------------- |
| 条件渲染隐藏手机号                          | 数据早已打进产物                |
| 模块顶层 `throw` 校验内容                 | Vite 不执行模块体，构建照样成功 |
| `127.0.0.1` 访问 `vite preview`         | 只绑定了 IPv6 回环              |
| 默认 `modulePreload`                      | 连懒加载的 chunk 也预加载了     |
| 默认 `manualChunks: {'react': ['react']}` | 只列了入口，其余落回主包        |
| 默认 `onUnhandledRequest: 'warn'`         | 未 mock 的请求真的发出去了      |

**规律**：默认值通常假设了最常见的场景，而你的场景可能不是它。

### C. 跨领域陷阱

| 问题                                                 | 根因                                     |
| ---------------------------------------------------- | ---------------------------------------- |
| `RequestInit.signal` 拒绝 jsdom 的 `AbortSignal` | V8 realm 的 `instanceof` 跨 realm 失效 |
| `IntersectionObserver is not defined`              | jsdom 不实现该 API                       |
| MDX 拒绝 `style` 属性                              | MDX 编译器不支持任意 HTML 属性           |
| `<script>` 不被提升到 `<head>`                   | React 19 只提升 title/meta/link          |
| `removeChild` of null                              | 我的 effect 删掉了 React 正在管理的节点  |

**规律**：库之间的边界（Vite↔React、jsdom↔Node、MDX↔HTML）
是问题最集中的地方。

### D. 我自己的判断失误

| 失误                                     | 教训                               |
| ---------------------------------------- | ---------------------------------- |
| 用 Zod 校验 GitHub 响应                  | 先算代价：85 KB chunk 换 15 行代码 |
| 测试里挑了会相交的标签（三次）           | 用测试数据前先确认前提成立         |
| 用 `getByText` 定位按钮                | 祖先元素带同样的文字；用 role      |
| 假设未枚举路径返回 404                   | 状态码取决于托管实现，先实测       |
| 把 `exactOptionalPropertyTypes` 当噪音 | 它拦下了三个真实问题               |

**规律**：多数"库的 bug"其实是自己的假设没验证。
**在怀疑代码之前，先把假设打印出来。**

---

## 如果你想继续做下去

按价值排序，这些是自然的下一步：

1. **补完内容**（27 处 `TODO:`、项目截图、技术标签）——
   内容完整度对个人网站的价值远高于再堆一个技术点。
2. **实际部署一次**，跑通 CI 与 Pages，把 [9.9 节](#99-验收状态不掩饰未做的事)
   里三个 ⚠️ 变成 ✅。
3. **测一次 Lighthouse**，根据报告做真实优化（而不是盲目调参）。
4. **加预渲染**（`vite-plugin-ssg` 或迁到 Astro），解决
   [9.8 节](#98-spa-在静态托管上的两个限制必须说清)的限制二。
5. **加一个真实后端**（哪怕是 Serverless Function），
   把联系表单从"写 localStorage"变成真的能收到消息 ——
   同时补上服务端校验（现在的蜜罐只是演示）。
