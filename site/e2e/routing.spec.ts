import { expect, test } from '@playwright/test';

import { clickNavLink, mainHeading } from './helpers';

/**
 * 路由与部署健壮性 E2E。
 *
 * ## 这组用例验证的是"部署后能不能用"
 *
 * 开发阶段有几件事一直没法验证 —— 因为当时起不了 HTTP 服务器、也没有浏览器。
 * 它们全都是**只有真实服务器 + 真实浏览器才能暴露**的问题：
 *
 * 1. **子路径部署**：`base: '/resume/'` 配错会让整站白屏；
 * 2. **SPA 刷新 404**：直接访问深层路由时，静态服务器找不到对应文件；
 * 3. **懒加载 chunk 的 URL**：动态 import 的路径若没带上 base 前缀，
 *    点击导航就会加载失败；
 * 4. **preview 的 base**：`vite preview` 默认 `base: '/'`，
 *    不显式传 `--base /resume/` 时所有资源都 404 —— 这个坑真的踩到了。
 */

test.describe('路由可达性', () => {
  const routes: { path: string; heading: string }[] = [
    { path: '', heading: '方睿杰' },
    { path: 'about', heading: '关于我' },
    { path: 'projects', heading: '项目与作品' },
    { path: 'posts', heading: '笔记与文章' },
    { path: 'resume', heading: '简历' },
    { path: 'contact', heading: '联系方式' },
  ];

  for (const route of routes) {
    test(`直接访问 /${route.path} 能渲染标题`, async ({ page }) => {
      // 直接访问深层路由 —— 这正是"刷新 404"最容易暴露的场景
      const response = await page.goto(route.path);

      expect(response?.status(), `HTTP 状态码应为 200`).toBe(200);
      await expect(mainHeading(page)).toContainText(route.heading);
    });
  }

  test('未知路径显示 404 页面而不是白屏', async ({ page }) => {
    await page.goto('this-route-does-not-exist');

    await expect(page.getByText('页面不存在')).toBeVisible();
    // 兜底页面必须给出口，否则用户就卡住了
    await expect(page.getByRole('link', { name: '回到首页' })).toBeVisible();
  });

  test('深层路由返回 200（每路由都有 HTML 入口）', async ({ page }) => {
    /**
     * 这条用例验证 `build-prerender.ts` 的产出。
     *
     * 没有那些 `about/index.html` 之类的文件时，静态服务器找不到对应资源，
     * 会走 404 兜底 —— 页面**看起来还是对的**（SPA 外壳加载后前端路由接管），
     * 但 HTTP 状态码是 404。对搜索引擎与分享抓取器来说，
     * 404 与 200 的意义完全不同。
     *
     * 所以这里断言的是**状态码**，而不是页面内容 ——
     * 只看内容的话，这两种情况无法区分。
     */
    const deepRoutes = [
      'about',
      'projects',
      'posts',
      'resume',
      'contact',
      'projects/elderly-care-platform',
      'posts/build-time-validation-in-vite',
    ];

    for (const route of deepRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), `/${route} 应返回 200，实际 ${String(response?.status())}`).toBe(
        200,
      );
      await expect(mainHeading(page)).toBeVisible();
    }
  });

  test('未枚举的路径也能显示应用内的 404 界面', async ({ page }) => {
    /**
     * 拼错的地址不在 pre-render 的枚举范围内，
     * 在 GitHub Pages 上会由 `404.html` 兜底。
     *
     * ## 为什么这里**不**断言状态码
     *
     * 第一版断言 `response.status() === 404`，结果本地跑出来是 200 ——
     * 因为 `vite preview` 默认带 history-fallback，对任何未命中文件的路径
     * 都返回根部的 `index.html`。而 GitHub Pages 会返回 404。
     *
     * 也就是说**状态码取决于托管实现**，不是本项目能控制的：
     * - GitHub Pages：未枚举路径 → 404.html + HTTP 404（静态托管的限制，没有服务端重写）
     * - vite preview：未枚举路径 → index.html + HTTP 200（自带的 SPA 回退）
     *
     * 对这两者都成立的、也真正重要的断言是：**应用能接管并显示自己的 404 界面**，
     * 而不是白屏或托管商的默认页。所以这里只断言这一点。
     *
     * 状态码的差异写在 `docs/DEPLOYMENT.md` 里，避免读者以为线上也是 200。
     */
    await page.goto('this-page-was-never-generated');

    await expect(page.getByText('页面不存在')).toBeVisible();
    await expect(page.getByRole('link', { name: '回到首页' })).toBeVisible();
  });

  test('未知项目 slug 显示错误页', async ({ page }) => {
    // loader 抛 404 Response，应由根路由的错误边界渲染，
    // 且**显示 loader 放在 body 里的那句具体消息**，而不是 "404 Not Found"
    await page.goto('projects/no-such-project');

    await expect(page.getByText(/找不到项目/)).toBeVisible();
  });

  test('通过导航栏跳转不会整页刷新', async ({ page }) => {
    await page.goto('');
    await expect(mainHeading(page)).toBeVisible();

    // 记录导航次数：SPA 内部跳转不应触发新的文档请求
    let documentRequests = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests += 1;
    });

    // clickNavLink 会自动处理移动端要先打开抽屉这件事
    await clickNavLink(page, '关于我');
    await expect(mainHeading(page)).toContainText('关于我');

    // 用 <a> 而不是 <Link> 会触发整页刷新，这里就是防线
    expect(documentRequests, 'SPA 导航不应产生新的文档请求').toBe(0);
  });

  test('浏览器后退能正确回到上一页', async ({ page }) => {
    await page.goto('');
    await expect(mainHeading(page)).toBeVisible();

    await clickNavLink(page, '项目');
    await expect(mainHeading(page)).toContainText('项目与作品');

    await page.goBack();

    await expect(mainHeading(page)).toContainText('方睿杰');
  });
});

test.describe('静态资源与懒加载', () => {
  test('所有资源都在 base 前缀下加载成功', async ({ page }) => {
    const failed: string[] = [];

    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${String(response.status())} ${response.url()}`);
    });

    await page.goto('');
    await expect(mainHeading(page)).toBeVisible();

    expect(failed, '首屏不应有失败的请求').toEqual([]);
  });

  test('逐个访问懒加载路由时没有请求失败', async ({ page }) => {
    // 每个路由都是独立的 chunk。任何 chunk 的 import 路径没带上 base 前缀，
    // 都会在这里暴露为 404
    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${String(response.status())} ${response.url()}`);
    });

    for (const path of ['about', 'projects', 'posts', 'resume', 'contact']) {
      await page.goto(path);
      await expect(mainHeading(page)).toBeVisible();
    }

    expect(failed, '懒加载 chunk 不应有失败请求').toEqual([]);
  });
});
