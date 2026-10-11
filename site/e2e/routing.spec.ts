import { expect, test } from '@playwright/test';

/**
 * 路由与部署健壮性 E2E。
 *
 * ## 这组用例验证的是"部署后能不能用"
 *
 * 前面几个阶段里，有几件事一直没法验证 —— 因为开发沙箱起不了 HTTP 服务器。
 * 它们全都是**只有真实服务器 + 真实浏览器才能暴露**的问题：
 *
 * 1. **子路径部署**：`base: '/resume/'` 配错会让整站白屏；
 * 2. **SPA 刷新 404**：直接访问深层路由时，静态服务器找不到对应文件；
 * 3. **懒加载 chunk 的 URL**：动态 import 的路径若没带上 base 前缀，
 *    点击导航就会加载失败。
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
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading);
    });
  }

  test('未知路径显示 404 页面而不是白屏', async ({ page }) => {
    await page.goto('this-route-does-not-exist');

    await expect(page.getByText('页面不存在')).toBeVisible();
    // 兜底页面必须给出口，否则用户就卡住了
    await expect(page.getByRole('link', { name: '回到首页' })).toBeVisible();
  });

  test('未知项目 slug 显示错误页', async ({ page }) => {
    // loader 抛 404 Response，应由根路由的错误边界渲染
    await page.goto('projects/no-such-project');

    await expect(page.getByText(/找不到项目/)).toBeVisible();
  });

  test('通过导航栏跳转不会整页刷新', async ({ page }) => {
    await page.goto('');

    // 记录导航次数：SPA 内部跳转不应触发新的 document 请求
    let documentRequests = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documentRequests += 1;
    });

    await page.getByRole('link', { name: '关于我' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('关于我');

    // 用 <a> 而不是 <Link> 会触发整页刷新，这里就是防线
    expect(documentRequests, 'SPA 导航不应产生新的文档请求').toBe(0);
  });

  test('浏览器后退能正确回到上一页', async ({ page }) => {
    await page.goto('');
    await page.getByRole('link', { name: '项目' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('项目与作品');

    await page.goBack();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('方睿杰');
  });
});

test.describe('静态资源与懒加载', () => {
  test('所有资源都在 base 前缀下加载成功', async ({ page }) => {
    const failed: string[] = [];

    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect(failed, '首屏不应有失败的请求').toEqual([]);
  });

  test('逐个访问懒加载路由时没有请求失败', async ({ page }) => {
    // 每个路由都是独立的 chunk。任何 chunk 的 import 路径没带上 base 前缀，
    // 都会在这里暴露为 404
    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
    });

    for (const path of ['about', 'projects', 'posts', 'resume', 'contact']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    expect(failed, '懒加载 chunk 不应有失败请求').toEqual([]);
  });
});
