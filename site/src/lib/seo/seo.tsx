/**
 * 页面级 SEO 元数据。
 *
 * ## 为什么不引 react-helmet-async
 *
 * React 19 起支持在组件里直接渲染 `<title>`、`<meta>`、`<link>` ——
 * React 会自动把它们**提升到 `<head>`**，并处理重复标签的替换。
 * 这是原生能力，不再需要第三方库。
 *
 * 对比一下引入 helmet 的代价：
 * - 多一个运行时依赖（约 10 KB）；
 * - 需要额外包一层 `HelmetProvider`；
 * - 它的核心价值（服务端渲染时的标签收集）在本项目不成立。
 *
 * 而原生方案的核心优势是**没有额外概念**：你写的 JSX 就是标签本身。
 *
 * ## 为什么需要 `key`
 *
 * React 19 用 `key` 判断"这两个标签是同一个"。同一组件在路由切换时
 * 重新渲染，若没有 key，React 可能保留旧的 `<title>`。
 * 加上 `key` 就能保证标签被正确替换。
 *
 * ## 一个必须说清的局限
 *
 * 本站是纯客户端渲染的 SPA。这套方案让**执行 JavaScript 的爬虫**
 * （Google、Bing 都能执行）看到正确的每页元数据，
 * 但**不执行 JavaScript 的爬虫**（多数社交平台的预览抓取器）
 * 只会看到 `index.html` 里的默认标签。
 *
 * 要彻底解决需要预渲染或 SSR —— 那属于架构变更（Next.js / Astro），
 * 已超出本项目范围。详见 docs/ROADMAP.md 的说明。
 */
import { useLayoutEffect } from 'react';

import { profile } from '@/lib/content';
import { toAbsoluteUrl } from '@/lib/seo/site-config';

export interface SeoProps {
  /** 页面标题。会以「标题 · 站点名」的形式呈现 */
  title: string;
  description: string;
  /** 站内路由路径，用于生成 canonical 与 OG URL */
  path: string;
  /**
   * Open Graph 类型。
   * `article` 用于文章页，`profile` 用于关于页，默认 `website`。
   */
  type?: 'website' | 'article' | 'profile';
  /** 文章页的发布日期（ISO 字符串） */
  publishedTime?: string;
  /** 文章页的标签 */
  tags?: readonly string[];
  /** 是否让搜索引擎索引。草稿或隐私页可设为 false */
  indexable?: boolean;
}

export function Seo({
  title,
  description,
  path,
  type = 'website',
  publishedTime,
  tags,
  indexable = true,
}: SeoProps) {
  const fullTitle = `${title} · ${profile.seo.siteName}`;
  const url = toAbsoluteUrl(path);

  /**
   * 设置文档标题，并清掉 `<head>` 里 React 不认识的重复标签。
   *
   * ## 为什么必须处理重复
   *
   * `index.html` 模板里有默认的 `<title>` 与 `<meta name="description">`
   * （为了不执行 JavaScript 的爬虫，见文件顶部说明）。
   * React 19 会把自己渲染的标签**提升到 `<head>`**，但它只管理自己创建的节点 ——
   * 模板里那两个静态标签会**留在原地**，形成重复。
   *
   * 后果比"多一行"严重得多：`document.title`、`querySelector` 与爬虫
   * 都取**第一个**，于是每页的标题与描述都退回成模板里的通用文案，
   * 页面级元数据完全失效。
   *
   * ## 一个必须避开的陷阱：不要删除 React 管理的节点
   *
   * 第一版这里写的是 `head.querySelectorAll('title')` 然后删掉除最后一个之外的全部，
   * 结果**破坏了客户端路由**：URL 变了但页面内容不换，
   * 控制台报 `TypeError: Cannot read properties of null (reading 'removeChild')`。
   *
   * 原因是路由切换时 React 要卸载上一次渲染的节点，
   * 而那个节点已经被这个 effect 删掉了 —— React 拿到 null 就抛错，
   * 整棵树的提交被中断，表现就是"点了导航没反应"。
   *
   * 修正有两点：
   * 1. 标题改用**命令式赋值**，不再渲染 `<title>` 元素，
   *    于是 React 的提交阶段完全不碰 `<title>`；
   * 2. 删除模板标签时用 `:not([data-seo-managed])` 限定范围，
   *    绝不触碰 React 创建的节点。
   */
  useLayoutEffect(() => {
    document.title = fullTitle;

    for (const stale of document.head.querySelectorAll(
      'meta[name="description"]:not([data-seo-managed])',
    )) {
      stale.remove();
    }
  }, [fullTitle]);

  return (
    <>
      <meta key="description" data-seo-managed="" name="description" content={description} />
      <link key="canonical" rel="canonical" href={url} />

      {/*
        不索引的页面用 noindex。注意 robots.txt 里的 Disallow 只是"建议"，
        而 noindex 是明确的指令 —— 两者作用不同：
        Disallow 阻止抓取（于是爬虫看不到 noindex），noindex 阻止索引。
        对单个页面用 noindex 更准确。
      */}
      {!indexable ? <meta key="robots" name="robots" content="noindex, nofollow" /> : null}

      {/* ---------- Open Graph（社交平台分享卡片） ---------- */}
      <meta key="og:type" property="og:type" content={type} />
      <meta key="og:title" property="og:title" content={fullTitle} />
      <meta key="og:description" property="og:description" content={description} />
      <meta key="og:url" property="og:url" content={url} />
      <meta key="og:site_name" property="og:site_name" content={profile.name} />
      <meta key="og:locale" property="og:locale" content="zh_CN" />

      {/* ---------- Twitter Card ---------- */}
      {/*
        用 summary 而不是 summary_large_image：本站没有稳定的分享配图。
        声明了却没有图，平台会显示一个灰色占位块，比小卡片更难看。
      */}
      <meta key="twitter:card" name="twitter:card" content="summary" />
      <meta key="twitter:title" name="twitter:title" content={fullTitle} />
      <meta key="twitter:description" name="twitter:description" content={description} />

      {/* ---------- 文章专属 ---------- */}
      {publishedTime !== undefined ? (
        <meta
          key="article:published_time"
          property="article:published_time"
          content={publishedTime}
        />
      ) : null}
      {(tags ?? []).map((tag) => (
        <meta key={`article:tag:${tag}`} property="article:tag" content={tag} />
      ))}
    </>
  );
}

/**
 * JSON-LD 结构化数据。
 *
 * ## 它解决什么问题
 *
 * 普通 meta 标签告诉搜索引擎"这页大概讲什么"，
 * 而 JSON-LD 用 schema.org 词汇明确声明**实体与关系**：
 * 这是一个人、他有哪些技能、这些文章是他写的。
 * 搜索引擎据此可以生成富摘要（rich result），而不是一行普通链接。
 *
 * ## 为什么用命令式插入而不是直接返回 <script>
 *
 * React 19 会自动把 `<title>` / `<meta>` / `<link>` 提升到 `<head>`，
 * 但**不会**提升 `<script>` —— 实测渲染出来的 JSON-LD 留在 `<body>` 里。
 *
 * 这不算功能缺陷（Google 能读取 body 里的 JSON-LD），但 `schema.org` 与
 * 多数校验工具都建议放在 `<head>`，而且 body 里的脚本容易被
 * 内容安全策略或其他工具误处理。所以这里显式插到 head，
 * 并顺带处理"路由切换时替换旧的"这件事。
 *
 * ## 为什么用 useLayoutEffect
 *
 * 与标题去重同理：在绘制前同步完成插入，避免出现"数据先缺后补"的中间状态。
 */
export function StructuredData({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data);

  useLayoutEffect(() => {
    const head = document.head;
    const selector = 'script[type="application/ld+json"][data-seo-managed]';

    // 一份页面只应有一个站点级/页面级 JSON-LD：先清掉本组件此前插入的
    for (const existing of head.querySelectorAll(selector)) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    // 用自定义属性标记"这段是 React 管理的"，便于上面精准清理，
    // 也避免误删将来可能手工加入的其他 JSON-LD
    script.setAttribute('data-seo-managed', '');
    // 用 textContent 而不是 innerHTML：这里只需要写入 JSON 文本，
    // 不需要解析 HTML，语义更准确也更安全
    script.textContent = json;

    head.appendChild(script);
  }, [json]);

  // 组件本身不渲染任何 DOM —— 脚本由上面的 effect 插到 head 里
  return null;
}
