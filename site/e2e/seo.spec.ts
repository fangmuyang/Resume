import { expect, test } from '@playwright/test';

import { clickNavLink } from './helpers';

/**
 * SEO 元数据的浏览器行为验证。
 *
 * ## 为什么必须有这组用例
 *
 * `scripts/verify-seo.ts` 检查的是**静态产物**：sitemap、robots.txt、
 * manifest、index.html 里的默认标签。但每页的 metadata 是
 * **React 19 在运行时提升到 `<head>`** 的 —— 那部分不在静态文件里，
 * 只能靠真实浏览器验证。
 *
 * 具体要验证三件事：
 * 1. 标签确实被提升到了 `<head>`（而不是留在了 `<body>` 里）；
 * 2. 路由切换时旧标签被替换，不会累积多条 canonical / og:title；
 * 3. 同一组件重新渲染不会产生重复标签。
 *
 * 第 2、3 点是 React 19 metadata 最容易出问题的地方 ——
 * 它靠标签的 `key` 判断"是不是同一个"，缺失 key 时会留下重复项。
 */
test.describe('页面级 SEO 元数据', () => {
  const routes = [
    { path: '', heading: '方睿杰', canonicalSuffix: '/resume/' },
    { path: 'about', heading: '关于我', canonicalSuffix: '/resume/about' },
    { path: 'projects', heading: '项目与作品', canonicalSuffix: '/resume/projects' },
    { path: 'posts', heading: '笔记与文章', canonicalSuffix: '/resume/posts' },
    { path: 'resume', heading: '简历', canonicalSuffix: '/resume/resume' },
    { path: 'contact', heading: '联系方式', canonicalSuffix: '/resume/contact' },
  ];

  for (const route of routes) {
    test(`/${route.path} 的 title 与 canonical 正确`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading);

      // 标题应包含页面名（React 19 在渲染后提升 <title>）
      await expect(page).toHaveTitle(/方睿杰|个人网站/);

      const canonical = page.locator('head link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);

      const href = await canonical.getAttribute('href');
      expect(href, 'canonical 必须是绝对地址').toMatch(/^https:\/\//);
      expect(href, `canonical 路径不正确：${String(href)}`).toContain(route.canonicalSuffix);
    });
  }

  test('元数据渲染在 <head> 而不是 <body>', async ({ page }) => {
    await page.goto('about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // React 19 的 metadata 提升如果失效，这些标签会留在 body 里
    const bodyHtml = await page.locator('body').innerHTML();

    for (const marker of ['rel="canonical"', 'property="og:title"', 'name="twitter:card"']) {
      expect(bodyHtml, `${marker} 不应出现在 <body> 中`).not.toContain(marker);
    }

    await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('head meta[name="twitter:card"]')).toHaveCount(1);
  });

  test('路由切换后元数据被替换而不是累积', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('方睿杰');

    /**
     * 每个页面都**等标题可见**之后才断言。
     *
     * 直接 `page.goto` 然后立刻断言，会在 React 还没渲染完时读到旧状态 ——
     * 本用例第一次运行时就是因为这个而失败（5 秒超时），
     * 看起来像"标签没被替换"，实际是断言跑早了。
     */
    for (const path of ['about', 'projects', 'posts', 'contact']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);

      /**
       * title 与 description 各只能有一份。
       *
       * 这两个标签在 `index.html` 模板里也有一份（供不执行 JS 的爬虫读取），
       * 所以 React 渲染后必须把模板那份清掉 ——
       * 否则 `<title>` 重复会让浏览器拿到旧的页面标题。
       * 这正是 Seo 组件里 useLayoutEffect 存在的原因。
       */
      await expect(page.locator('head title')).toHaveCount(1);
      await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
    }
  });

  test('浏览器标签页标题跟随路由变化', async ({ page }) => {
    // 这一条直接盯着"用户看得见的结果"：标签页上的文字
    await page.goto('about');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/关于我/);

    await page.goto('projects');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/项目与作品/);

    // 回到首页
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/前端开发/);
  });

  test('用站内链接跳转同样只保留一份元数据', async ({ page }) => {
    // 客户端路由切换（不重新加载文档）是 key 机制最容易失效的路径
    await page.goto('');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();

    /**
     * 通过导航点击切换，而不是 `page.goto`。
     *
     * 两者走的是不同的路径：`goto` 会重新加载文档（React 从头挂载），
     * 而点击导航是客户端路由切换 —— 元数据标签的增删只发生在后者，
     * 也正是"重复标签"最容易出现的地方。
     *
     * 用 clickNavLink 而不是直接点链接：移动端的导航藏在抽屉里。
     */
    for (const name of ['关于我', '项目', '笔记', '联系']) {
      await clickNavLink(page, name);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();

      await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('head title')).toHaveCount(1);
      await expect(page.locator('head meta[name="description"]')).toHaveCount(1);
    }
  });

  test('文章页带 article 专属元数据与 JSON-LD', async ({ page }) => {
    /**
     * 用已知的 slug 直接打开，而不是"点列表里的第一篇"。
     *
     * 从列表点进去会依赖列表渲染顺序与链接文字，用例更脆；
     * 而这里要验证的是文章页本身的元数据。
     */
    await page.goto('posts/false-security-of-bad-checks');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.locator('head meta[property="article:published_time"]')).toHaveCount(1);

    // JSON-LD 必须是合法 JSON，否则搜索引擎会忽略它
    const ldJson = page.locator('head script[type="application/ld+json"]');
    await expect(ldJson.first()).toBeAttached();

    const content = await ldJson.first().textContent();
    expect(content).not.toBeNull();

    const parsed = JSON.parse(content as string) as Record<string, unknown>;
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('TechArticle');
    expect(parsed['headline']).toBeTruthy();
    expect(parsed['datePublished']).toBeTruthy();
  });

  test('首页含站点级 JSON-LD', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const parsed = await page.evaluate(() => {
      const script = document.querySelector('head script[type="application/ld+json"]');
      return script === null ? null : (JSON.parse(script.textContent ?? '{}') as unknown);
    });

    expect(parsed).not.toBeNull();
    expect((parsed as Record<string, unknown>)['@type']).toBe('WebSite');
  });

  test('404 页面声明 noindex', async ({ page }) => {
    await page.goto('this-page-does-not-exist');
    await expect(page.getByText('页面不存在')).toBeVisible();

    // 失效外链不该在搜索结果里留下"页面不存在"
    const robots = page.locator('head meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    await expect(robots).toHaveAttribute('content', /noindex/);
  });
});
