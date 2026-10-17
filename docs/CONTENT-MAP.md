# 内容地图（改哪里 · 每个页面在说什么）

这份文档回答三个问题：

1. **每个页面的网址是什么、代码在哪个文件、内容来自哪个 JSON**
2. **想改某句话该动哪个文件**
3. **那 27 处「待补充」分别在哪里、该怎么填**

站点根地址：**https://fangmuyang.github.io/resume/**

> 下面所有路径都相对于 `site/`，除非另注说明。

---

## 1. 六个页面总览

| #   | 网址        | 页面代码                 | 内容来源                                                               |
| --- | ----------- | ------------------------ | ---------------------------------------------------------------------- |
| 1   | `/`         | `src/pages/home.tsx`     | `profile.json`、`resume.json`、`skills.json`、`projects/*.json`        |
| 2   | `/about`    | `src/pages/about.tsx`    | `profile.json`、`resume.json`、`skills.json`                           |
| 3   | `/projects` | `src/pages/projects.tsx` | `projects/*.json`、`enum-labels.json`、`profile.json`（GitHub 集成）   |
| 4   | `/posts`    | `src/pages/posts.tsx`    | `posts-index.json`（由 `posts/*.mdx` 生成）                            |
| 5   | `/resume`   | `src/pages/resume.tsx`   | `resume.json`、`skills.json`、`resume-asset.json`、`public/resume.pdf` |
| 6   | `/contact`  | `src/pages/contact.tsx`  | `profile.json`、`enum-labels.json`                                     |

两个详情页（不在导航栏里，从列表点进去）：

| 网址               | 页面代码                           | 内容来源                                |
| ------------------ | ---------------------------------- | --------------------------------------- |
| `/projects/<slug>` | `src/pages/project-detail.tsx`     | `projects/<slug>.json`                  |
| `/posts/<slug>`    | `src/pages/post-detail.tsx`        | `posts/<slug>.mdx` 的正文 + frontmatter |
| 任意不存在的地址   | `src/pages/not-found.tsx`          | `page-meta.json → notFound`             |
| 数据加载失败       | `src/app/route-error-boundary.tsx` | `page-meta.json → error`                |

**全部页面级 SEO 文案**（标题、描述）都来自 `content/page-meta.json`，
通过 `src/lib/seo/seo.tsx` 的 `<Seo>` 组件注入。

---

## 2. 逐页说明

### 2.1 首页 `/`

网址：https://fangmuyang.github.io/resume/

代码：`src/pages/home.tsx`

从上到下的区块：

| 区块                       | 内容来源                                       |
| -------------------------- | ---------------------------------------------- |
| Hero：头衔、姓名、个人简介 | `profile.json` → `headline` / `name` / `bio`   |
| 「精选项目」卡片           | `projects/*.json` 中 `featured: true` 的那几个 |
| 「能力概览」（技能分组）   | `skills.json`                                  |
| 「教育背景」               | `resume.json` → `education[0]`                 |

改哪里：想改首页那句自我介绍 → `profile.json` 的 `bio`（同一句也出现在关于我页）。

> `profile.json` 的 `location` 与 `availability` **不在首页**：
> `location` 在关于我页，`availability` 在联系页。
> `aka`（别名「方沐」）不显示在页面上，只写进 JSON-LD 结构化数据。

---

### 2.2 关于我 `/about`

网址：https://fangmuyang.github.io/resume/about

代码：`src/pages/about.tsx`

| 区块           | 内容来源                                                                |
| -------------- | ----------------------------------------------------------------------- |
| 个人简介正文   | `profile.json` → `bio`                                                  |
| 所在地         | `profile.json` → `location` ← 待补充                                    |
| 联系方式列表   | `profile.json` → `links`（只显示 `public: true` 的）                    |
| 教育经历时间线 | `resume.json` → `education`（学校、专业、学位、起止、课程、排名、亮点） |
| 技能分组       | `skills.json`                                                           |
| 获奖           | `resume.json` → `awards`                                                |

---

### 2.3 项目与作品 `/projects`

网址：https://fangmuyang.github.io/resume/projects

代码：`src/pages/projects.tsx`
卡片组件：`src/features/projects/project-card.tsx`
筛选条：`src/features/projects/tag-filter.tsx`

| 区块                                          | 内容来源                                                             |
| --------------------------------------------- | -------------------------------------------------------------------- |
| 引导语（「从课程项目到正在迭代的个人站点…」） | 某个 `projects/*.json` 的 `listIntro` 字段（约定只在一个项目上填它） |
| 技术/领域标签筛选条                           | 从 `projects/*.json` 的 `tech` + `tags` 自动聚合                     |
| 项目卡片                                      | `projects/*.json`                                                    |
| 「开源仓库」区块（实时拉 GitHub）             | `profile.json` → `integrations.githubUsername` / `githubRepoLimit`   |

卡片的字段映射：

```
项目名        ← name
状态徽章      ← status（active/completed/archived），中文标签在 enum-labels.json
角色 · 时间   ← role + period
一句话简介     ← summary      ← 待补充
技术标签      ← tech
领域标签      ← tags
封面图        ← cover（null 表示不渲染）
```

筛选状态的参数：`?tags=Vue,HTML&match=all`
（`match` 不写默认 `any` = 命中任一；`all` = 全部命中）

---

### 2.4 笔记与文章 `/posts`

网址：https://fangmuyang.github.io/resume/posts

代码：`src/pages/posts.tsx`
文章正文页：`src/pages/post-detail.tsx`

| 区块         | 内容来源                                             |
| ------------ | ---------------------------------------------------- |
| 页面描述     | `page-meta.json` → `posts.description`               |
| 涉及主题标签 | 从所有文章的 frontmatter `tags` 聚合                 |
| 文章列表     | `content/posts-index.json`（**自动生成，不要手改**） |

文章列表的元数据来自每篇 `.mdx` 的 frontmatter：

```yaml
---
title: 文章标题
summary: 一句话摘要（列表和 SEO 描述都用它）
date: 2025-06-10
updated: null # 有更新时填日期
tags: [Vite, 构建原理]
draft: false # true = 不在列表、不进 sitemap、没有路由入口
---
```

现有三篇文章：

| slug                            | 网址                                   |
| ------------------------------- | -------------------------------------- |
| `build-time-validation-in-vite` | `/posts/build-time-validation-in-vite` |
| `pdf-layout-reconstruction`     | `/posts/pdf-layout-reconstruction`     |
| `false-security-of-bad-checks`  | `/posts/false-security-of-bad-checks`  |

正文里可以直接用两个组件：`<Callout>` 和 `<TerminalSession>`。

---

### 2.5 简历 `/resume`

网址：https://fangmuyang.github.io/resume/resume

代码：`src/pages/resume.tsx`
PDF 预览组件：`src/features/resume/pdf-preview.tsx`

| 区块               | 内容来源                                             |
| ------------------ | ---------------------------------------------------- |
| 页面描述           | `page-meta.json` → `resume.description`              |
| 下载按钮、文件大小 | `resume-asset.json` → `label` / `sizeBytes` / `file` |
| PDF 预览说明       | `resume-asset.json` → `description`                  |
| 求职自述           | `resume.json` → `summary` ← 待补充                   |
| 教育经历           | `resume.json` → `education`                          |
| 项目经历           | `resume.json` → `projects`                           |
| 专业技能           | `skills.json`                                        |
| 获奖               | `resume.json` → `awards`                             |
| 实际 PDF 文件      | `site/public/resume.pdf`                             |

> ### ⚠️ 一个真实的重复：项目数据有两份
>
> **作品集页**读 `projects/*.json`（字段多：背景、贡献、方案、难点、成果、封面、截图）。
> **简历页**读 `resume.json` 里的 `projects` 数组（字段少：slug、name、role、period、tech、bullets、url）。
>
> 同一个项目在两处各有一份，**改一处不会同步另一处**。
> 比如把 `elderly-care-platform` 的技术栈从 `Vue` 改成 `React`，
> 必须同时改 `content/projects/elderly-care-platform.json` 的 `tech`
> 和 `content/resume.json` 里对应项目的 `tech`。
>
> 这是「展示形态不同」导致的，不是 bug，但改内容时容易漏。

---

### 2.6 联系方式 `/contact`

网址：https://fangmuyang.github.io/resume/contact

代码：`src/pages/contact.tsx`
表单：`src/features/contact/contact-form.tsx`
表单校验：`src/features/contact/contact-schema.ts`

| 区块                 | 内容来源                                                        |
| -------------------- | --------------------------------------------------------------- |
| 页面描述             | `page-meta.json` → `contact.description`                        |
| 左侧「直接联系」列表 | `profile.json` → `links`（只显示 `public: true`）               |
| 可合作状态           | `profile.json` → `availability`                                 |
| 右侧「给我留言」表单 | 表单标签与校验提示写在 `contact-form.tsx` / `contact-schema.ts` |
| 主题下拉选项         | `enum-labels.json` → `contactTopic`                             |

**注意**：表单提交后只写入浏览器 `localStorage`，**没有任何后端**。
它演示的是校验与状态机，不是真的能收到消息。想真收信需要一个后端或第三方表单服务。

**手机号**：`profile.json` 里 `privacy.showPhone: false`，且该条目 `public: false`。
构建时会生成脱敏副本 `profile-public.json`，手机号**从未进入网页产物**。
它只存在于 `profile.json`（源码）与公开可下载的 `public/resume.pdf` 里。

---

## 3. 内容文件总表

| 文件                          | 管什么                                                                                  | 改完要不要重新生成               |
| ----------------------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| `content/profile.json`        | 姓名、别名、头衔、简介、所在地、可合作状态、联系方式、隐私开关、SEO 默认值、GitHub 集成 | **要**：`pnpm build:content`     |
| `content/profile-public.json` | 上面的脱敏副本                                                                          | 不要手改（自动生成）             |
| `content/resume.json`         | 求职自述、教育经历、简历页的项目列表、获奖                                              | 不用                             |
| `content/skills.json`         | 技能分组（5 组）                                                                        | 不用                             |
| `content/projects/*.json`     | 作品集卡片与详情页                                                                      | 不用                             |
| `content/posts/*.mdx`         | 文章正文 + frontmatter                                                                  | **要**：`pnpm build:posts-index` |
| `content/posts-index.json`    | 文章索引                                                                                | 不要手改（自动生成）             |
| `content/page-meta.json`      | 8 个页面的 SEO 标题与描述                                                               | 不用                             |
| `content/enum-labels.json`    | 项目状态、表单主题的中文标签                                                            | 不用                             |
| `content/resume-asset.json`   | PDF 的标签、说明、体积                                                                  | 不用                             |
| `site/public/resume.pdf`      | 实际的简历文件                                                                          | 替换后改 `sizeBytes`             |

**生成 `posts-index.json` 的命令**：`pnpm build:posts-index`
**重新生成脱敏副本**：`pnpm build:content`
**两者都重跑 + 完整校验**：`pnpm build`

> `page-meta.json` 的 `description` 不只用于 SEO —— `posts`、`contact`、`resume`
> 三个页面的**正文副标题**也直接复用它（避免同一句话写两遍）。

---

## 4. 待补充清单（27 处）

运行 `pnpm validate` 会显示统计。页面上这些地方会渲染成**黄色虚线「待补充」块**，不是报错。

### 4.1 个人信息（`content/profile.json`）

| 行  | 字段       | 现在的内容                 | 建议填什么                                                             |
| --- | ---------- | -------------------------- | ---------------------------------------------------------------------- |
| 5   | `bio`      | `TODO:一句话自我介绍…`     | 2–3 句，说明你在做什么、关注什么方向。会出现在**首页 Hero 和关于我页** |
| 6   | `location` | `TODO:所在城市，例如 杭州` | 城市名，如 `杭州`。只出现在**关于我页**                                |

### 4.2 简历自述（`content/resume.json`）

| 行  | 字段      | 建议填什么                                                       |
| --- | --------- | ---------------------------------------------------------------- |
| 3   | `summary` | 3–4 句求职自述：技能范围 + 代表项目 + 想做的事。出现在**简历页** |

### 4.3 四个项目的详情（`content/projects/*.json`）

四个文件的结构完全相同，每个 6 处待补充：

```
elderly-care-platform.json   ← 养生居智慧养老
rope-net-qa.json             ← 绳网问答
herbal-clinic-ai.json        ← 杏林智调医台
personal-website.json        ← Fangmu.online 个人网页
```

| 行  | 字段            | 出现在哪           | 建议填什么                                     |
| --- | --------------- | ------------------ | ---------------------------------------------- |
| 4   | `summary`       | **卡片 + 详情页**  | 一句话简介，30 字以内                          |
| 16  | `background`    | 详情页「项目背景」 | 要解决的问题、面向谁                           |
| 17  | `contributions` | 详情页「我的贡献」 | 数组，一条一项职责，用动词开头                 |
| 18  | `approaches`    | 详情页「技术方案」 | 数组，关键实现与选型理由                       |
| 19  | `challenges`    | 详情页「难点」     | 数组，难点 + 怎么解决的                        |
| 20  | `results`       | 详情页「成果」     | 数组，**尽量量化**：用户数、性能提升、是否上线 |

填法示例（`rope-net-qa.json`）：

```json
"summary": "面向绳网行业的智能问答工具，用大模型替代人工答疑。",
"background": "绳网行业的产品参数咨询量大且高度重复，人工答疑成本高。",
"contributions": [
  "独立完成 Uni-app 端问答界面与多轮对话状态管理",
  "封装通义千问 API 调用层，加入超时重试与降级提示"
],
"approaches": [
  "Uni-app 一套代码同时编译小程序与 H5",
  "Python SDK 处理后端逻辑，由通义千问 API 理解意图并生成回复"
],
"challenges": [
  "大模型响应偶发超时：加 8 秒超时 + 重试一次，仍失败则降级为预设话术"
],
"results": [
  "课程项目验收第一名",
  "常见问题平均响应时间从人工的 3 分钟降到 10 秒内"
]
```

### 4.4 补齐后要做什么

```bash
cd C:\Dsh\Resume
pnpm validate      # 确认没有 TODO: 了
pnpm check         # 类型 + Lint + 108 个单测
git add -A
git commit -m "content: 补齐个人简介与项目详情"
git push           # 触发 CI 与自动部署
```

### 4.5 另外五处空缺（不是 `TODO:`，但内容上是空的）

`pnpm validate` 只统计 `TODO:` 文本。下面这些字段是 `null` 或空数组，
**不会报错**，但页面上对应的视觉元素就消失了：

| 字段          | 位置                           | 现状   | 影响                                     |
| ------------- | ------------------------------ | ------ | ---------------------------------------- |
| `avatar`      | `profile.json`                 | `null` | 没有头像                                 |
| `cover`       | 4 个 `projects/*.json`         | `null` | 作品集卡片**没有配图**，退化为纯文字版式 |
| `screenshots` | 4 个 `projects/*.json`         | `[]`   | 项目详情页没有截图区                     |
| `links`       | 4 个 `projects/*.json`         | `[]`   | 项目没有「在线预览 / 源码」链接          |
| `highlights`  | `resume.json` → `education[0]` | `[]`   | 教育经历没有亮点条目                     |

补法：把图片放进 `site/public/`（例如 `site/public/projects/rope-net-qa/cover.png`），
然后在 JSON 里写**相对 `public` 的路径**：

```json
"cover": "projects/rope-net-qa/cover.png",
"screenshots": [
  "projects/rope-net-qa/01-chat.png",
  "projects/rope-net-qa/02-result.png"
]
```

构建时会自动加上站点前缀（`/resume/...`），不需要自己写 `/resume/`。

---

## 5. 三个常见改动示例

### 5.1 新增一个项目

1. 复制 `content/projects/personal-website.json` 为 `content/projects/我的项目slug.json`
   （**文件名就是 URL 的 slug**，用小写英文与连字符）
2. 改里面的 `slug`（必须与文件名一致）、`name`、`tech`、`tags` 等字段
3. 若想让它在首页「精选项目」出现，设 `featured: true`
4. `pnpm validate` 校验，推送即自动上线
5. 新网址：`/resume/projects/我的项目slug`

> 别忘了 `resume.json` 里也要加一条，否则简历页看不到这个项目。

### 5.2 新增一篇文章

1. 在 `content/posts/` 新建 `我的文章slug.mdx`
2. 开头写 frontmatter（见 2.4 节的格式）
3. 正文用 Markdown，可嵌入 `<Callout>` / `<TerminalSession>`
4. 运行 `pnpm build:posts-index` 更新索引
5. 推送

写草稿：frontmatter 里 `draft: true`，它就不会出现在列表、sitemap，也不会生成路由入口。

### 5.3 换掉简历 PDF

1. 用新 PDF 覆盖 `site/public/resume.pdf`
2. 更新 `content/resume-asset.json` 的 `sizeBytes`（字节数）
   查看大小：`(Get-Item site\public\resume.pdf).Length`
3. 推送

> 当前 PDF 含手机号且可公开下载。若要脱敏，替换成去掉手机号的版本即可。

---

## 6. 想改「页面标题和 SEO 描述」

全部集中在 `content/page-meta.json`：

```json
{
  "home": { "title": "前端开发 · 个人作品集", "description": "…" },
  "about": { "title": "关于我", "description": "…" },
  "projects": { "title": "项目与作品", "description": "…" },
  "posts": { "title": "笔记与文章", "description": "…" },
  "resume": { "title": "简历", "description": "…" },
  "contact": { "title": "联系方式", "description": "…" },
  "notFound": { "title": "页面不存在", "description": "…" },
  "error": { "title": "出错了", "description": "…" }
}
```

长度限制由 schema 强制：`title` ≤ 40 字，`description` ≤ 160 字。

另外 `index.html` 里有一份**静态默认描述**（给不执行 JS 的爬虫用）。
如果改了 `profile.json` 的 `seo.defaultDescription`，记得同步 `site/index.html` 的
`<meta name="description">` —— `pnpm verify:seo` 会检查这两处是否一致，不一致会报错。

---

## 7. 改完之后怎么确认没写坏

```bash
cd C:\Dsh\Resume
pnpm validate          # 内容是否符合 schema、剩余 TODO 数
pnpm dev               # 本地看效果：http://localhost:5173/
pnpm check             # 全量检查（含 108 单测）
pnpm build             # 生产构建 + 7 个守卫
```

本地预览时**用 `localhost`，不要用 `127.0.0.1`**（Vite 只绑 IPv6 回环）。

推送后 GitHub Actions 会自动跑 CI 并部署，约 4 分钟。
线上地址：https://fangmuyang.github.io/resume/
