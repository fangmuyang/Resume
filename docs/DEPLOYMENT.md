# 部署指南

本文档覆盖：GitHub Pages 的部署配置、自定义域名切换、SPA 在静态托管上的行为与限制、
以及出问题时怎么排查。

---

## 1. 首次部署（GitHub Pages 项目站点）

### 1.1 仓库侧设置

1. 把代码推送到 GitHub 仓库的 `main` 分支。
2. 进入 **Settings → Pages**。
3. **Source** 选择 **GitHub Actions**（不是 "Deploy from a branch"）。

这一步不能漏：如果 Source 停留在 "Deploy from a branch"，`deploy.yml`
里的 `actions/deploy-pages` 会因为没有 Pages 环境而失败。

### 1.2 站点地址与仓库名的关系

GitHub Pages 的**项目站点**地址形如：

```
https://<用户名>.github.io/<仓库名>/
```

本项目默认配置就是这个形态：

| 配置项             | 值                                    | 位置                                       |
| ------------------ | ------------------------------------- | ------------------------------------------ |
| 站点地址           | `https://fangmuyang.github.io/resume` | `site/src/lib/seo/site-config.ts` 的默认值 |
| 资源前缀（`base`） | `/resume/`                            | 由上面的地址**推导**，不单独配置           |

**如果仓库名不是 `resume`**，改 `site-config.ts` 里的默认值即可 ——
资源前缀、canonical、sitemap、manifest 的 scope 都会跟着变。
这正是把这些值集中在一个地方的原因（见该文件顶部注释）。

### 1.3 部署流程

`deploy.yml` 在推送到 `main` 时触发，两步：

1. **build**：安装依赖 → 构建 → 上传 `site/dist` 作为 Pages artifact；
2. **deploy**：把 artifact 发布到 Pages。

> **部署不依赖 CI 成功。** 这是个人站点的取舍：push 到 `main` 就发布更直接。
> 若希望严格门禁，把触发改成 `workflow_run`（等 CI 完成后再部署），
> 并给 `main` 配置分支保护规则要求 CI 通过。
> 见 `docs/ROADMAP.md` 的阶段 11 记录。

---

## 2. 切换到自定义域名

以 `fangmu.online` 为例。

### 2.1 为什么不能只改 DNS

自定义域名部署时，**资源前缀必须变成 `/`**：

| 形态       | 站点地址                              | 资源前缀   |
| ---------- | ------------------------------------- | ---------- |
| 项目站点   | `https://fangmuyang.github.io/resume` | `/resume/` |
| 自定义域名 | `https://fangmu.online`               | `/`        |

原因是域名的根就是站点根，没有 `/resume/` 这一段。
如果继续用 `/resume/`，所有 JS/CSS 都会 404，**整站白屏**。

而"站点地址"与"资源前缀"必须同时改变，否则 canonical 会指向一个
资源加载不出来的地址。所以本项目用**一个变量**同时决定两者。

### 2.2 配置方式

1. **Settings → Secrets and variables → Actions → Variables**
   新增变量：

   | 名称       | 值                      |
   | ---------- | ----------------------- |
   | `SITE_URL` | `https://fangmu.online` |

2. **Settings → Pages → Custom domain** 填入 `fangmu.online` 并保存。

   > 保存后 GitHub 会在构建产物里查找 `CNAME` 文件。
   > 本项目的 `CNAME` 不需要手写进 `public/` ——
   > `actions/configure-pages` 会依据 Pages 设置处理域名绑定。
   > 如果你想让域名配置也进入版本管理，可以在 `site/public/CNAME`
   > 里写入 `fangmu.online`（一行、无协议前缀），它会随构建产物一起发布。

3. 在域名服务商处配置 DNS。

   | 记录类型 | 主机记录 | 记录值                 |
   | -------- | -------- | ---------------------- |
   | A        | `@`      | `185.199.108.153`      |
   | A        | `@`      | `185.199.109.153`      |
   | A        | `@`      | `185.199.110.153`      |
   | A        | `@`      | `185.199.111.153`      |
   | CNAME    | `www`    | `fangmuyang.github.io` |

   四个 A 记录是 GitHub Pages 的官方地址，配置多个是为了就近解析与容错。
   只用其中一个也能工作，但可用性会下降。

4. 等待 DNS 生效（几分钟到 24 小时），回到 Pages 设置页勾选
   **Enforce HTTPS**。

> ### 关于中国大陆的 ICP 备案
>
> `fangmu.online` 如果注册的是 `.cn` 或使用中国大陆的服务器/加速服务，
> 按规定需要完成 **ICP 备案**，否则会被拦截。
>
> 但 GitHub Pages 的服务器在境外，**不经过大陆的接入商**，
> 因此这条路径通常不需要备案 —— 代价是国内部分网络访问可能不稳定。
>
> 如果域名要用于大陆用户为主的场景，更现实的选择是：
> 用国内的对象存储 + CDN（这类服务**要求**备案），
> 而这会改变部署方式（不再是 GitHub Pages）。
> 本文档不覆盖该方案。

### 2.3 切换后必须验证的四件事

改完域名后，**不要只看首页能不能打开** —— 下面四项各自对应一类常见问题：

```bash
# 1. 用自定义域名的形态本地构建一次，确认前缀推导正确
cd site
VITE_SITE_URL=https://fangmu.online pnpm build
# 应当看到：index.html 的资源引用带统一前缀 — 前缀 "/"

# 2. 确认 sitemap 里的地址是新域名
grep '<loc>' dist/sitemap.xml | head -3
# 应当看到 https://fangmu.online/... 而不是 github.io

# 3. 确认 manifest 的 scope 是 "/"
cat dist/manifest.webmanifest | grep -o '"scope":"[^"]*"'

# 4. 部署后用真实浏览器验证（E2E 也会用同一个变量）
VITE_SITE_URL=https://fangmu.online pnpm test:e2e
```

第 3 项特别容易漏：manifest 的 `scope` 与 `start_url` 若仍是 `/resume/`，
PWA 装上后会打开一个不存在的地址。

---

## 3. SPA 在静态托管上的行为与限制

这是本项目的架构约束，**必须理解**，否则会误判问题。

### 3.1 深层路由为什么能直接访问

纯前端构建只产出根部的 `index.html`。用户直接访问 `/resume/about` 时，
静态服务器要找 `about/index.html` 这个文件 —— 找不到就 404。

本项目的做法是在构建后**为每个路由复制一份 HTML 入口**
（`scripts/build-prerender.ts`）：

```
dist/
  index.html                      → /
  about/index.html                → /about
  projects/index.html             → /projects
  projects/elderly-care-platform/index.html
  posts/build-time-validation-in-vite/index.html
  404.html                        → 兜底
```

这样静态托管的默认行为（目录 → 目录下的 `index.html`）就能正确响应，
加载后客户端路由接管渲染。E2E 里有一条用例专门断言深层路由返回 **200**。

### 3.2 两个限制

**限制一：未枚举的路径在 GitHub Pages 上返回 HTTP 404。**

`404.html` 让用户看到应用内的 404 界面（而不是托管商的默认页），
但**状态码仍是 404** —— 静态托管没有服务端重写，绕不过去。

影响：

- 对**枚举到的**路由（`about`、`projects`、每篇文章/项目详情）：返回 200，无影响；
- 对**拼错的地址**：返回 404 —— 这其实是正确的语义；
- 对**新增内容忘了重新构建**：会返回 404。所以内容更新必须走构建流程。

> 顺带说明：`vite preview` 本地预览时对未命中路径返回 **200**
> （它自带 history-fallback），与 GitHub Pages 行为不同。
> 所以 E2E 里那条用例只断言"应用能接管"，不断言状态码。

**限制二：页面内容由 JavaScript 渲染，不是预渲染。**

这些 HTML 入口**只有壳**（`<div id="root"></div>` + 资源引用）：

- **执行 JavaScript 的爬虫**（Google、Bing）能拿到完整内容与每页元数据；
- **不执行 JavaScript 的爬虫**（多数社交平台的预览抓取器）
  只会看到 `index.html` 里的默认 title/description。

所以分享出去的链接，预览卡片是**通用描述**，而不是当页的。
彻底解决需要预渲染或 SSR（Next.js / Astro 等），属于架构变更，超出本项目范围。

`index.html` 里的默认标签因此刻意与首页保持一致，让降级结果不至于是错的，
并由 `pnpm verify:seo` 在构建后核对两者是否同步。

---

## 4. 排查清单

| 症状                                | 最可能的原因                           | 怎么确认                                                         |
| ----------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| 整站白屏、Console 全是 404          | `base` 与部署前缀不一致                | `pnpm verify:build` 会打印推导出的前缀                           |
| 首页正常，深层路由刷新 404          | 每路由 HTML 入口没生成                 | `pnpm verify:seo` 检查入口齐备性；确认构建里含 `build-prerender` |
| 本地 200、线上 404                  | 正常现象（见 3.2）                     | 用 `pnpm test:e2e` 验证深层路由                                  |
| PWA 装上后打不开                    | manifest 的 `scope` / `start_url` 不对 | `cat dist/manifest.webmanifest`，应等于资源前缀                  |
| canonical 指向旧域名                | `SITE_URL` 变量没设或没生效            | `pnpm verify:seo` 会对比 sitemap 与配置                          |
| 社交分享预览没有图/描述             | 抓取器不执行 JS（见 3.2 限制二）       | 属已知限制                                                       |
| Actions 部署失败在 `deploy-pages`   | Pages 的 Source 不是 "GitHub Actions"  | Settings → Pages 检查                                            |
| Actions 报 `--frozen-lockfile` 失败 | `package.json` 与锁文件不一致          | 本地跑 `pnpm install` 并提交锁文件                               |

所有守卫都可以单独运行：

```bash
cd site
pnpm verify:build      # base 前缀、路由分块、动态导入路径
pnpm verify:seo        # sitemap、robots、manifest、路由入口、404 回退
pnpm verify:privacy    # 私密字段是否泄漏进产物
pnpm verify:content    # 文案是否硬编码在组件里
pnpm verify:search     # 搜索索引覆盖与跳转目标
pnpm validate          # 内容是否符合 schema
```

---

## 5. 回滚

部署产物是 Actions artifact，**不在仓库里产生提交**。

- 在 **Actions → Deploy to GitHub Pages** 里找到上一次成功的运行，
  点 **Re-run all jobs** 即可回到那个版本；
- 或者把 `main` 回滚到目标提交再推送（会触发新的部署）。

相比 `gh-pages` 分支方案，这里的回滚不涉及重写分支历史。
