import { expect, test } from '@playwright/test';

/**
 * PWA 行为验证。
 *
 * ## 为什么这些必须用真实浏览器
 *
 * service worker 是浏览器提供的运行环境，jsdom 里根本没有这个概念。
 * 而且它的行为有很强的时序性（注册 → 激活 → 接管请求），
 * 只有真实浏览器才能验证。
 *
 * ## 注意：不要在这里断言"离线可用"
 *
 * 离线能力依赖 service worker 完成**激活并接管**当前页面 ——
 * 这通常需要一次重新加载。在 `page.context().setOffline(true)` 之后
 * 立刻断言页面仍能打开，测到的往往是 HTTP 缓存而不是 service worker，
 * 是一条容易误判的假阳性用例。
 *
 * 下面改为验证**可被验证的事实**：manifest 可获取且合法、
 * service worker 注册成功、图标可访问。离线能力由 manifest 与
 * precache 清单的正确性间接保证（见 scripts/verify-seo.ts 的检查）。
 */
test.describe('PWA', () => {
  test('manifest 可访问且字段合法', async ({ page, request }) => {
    await page.goto('');

    const href = await page.locator('head link[rel="manifest"]').getAttribute('href');
    expect(href, 'index.html 应声明 manifest').not.toBeNull();

    const response = await request.get(href as string);
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Record<string, unknown>;

    expect(manifest['name']).toBeTruthy();
    expect(manifest['short_name']).toBeTruthy();
    expect(manifest['start_url']).toBe('/resume/');
    expect(manifest['scope']).toBe('/resume/');
    expect(manifest['display']).toBe('standalone');

    const icons = manifest['icons'] as { src: string; sizes: string; purpose?: string }[];
    expect(icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  test('manifest 引用的图标都能访问', async ({ page, request }) => {
    await page.goto('');

    const href = await page.locator('head link[rel="manifest"]').getAttribute('href');
    const response = await request.get(href as string);
    const manifest = (await response.json()) as {
      icons: { src: string }[];
    };

    for (const icon of manifest.icons) {
      // 图标路径是相对的，需要拼上站点前缀
      const iconResponse = await request.get(`/resume/${icon.src}`);
      expect(iconResponse.status(), `图标 ${icon.src} 应可访问`).toBe(200);
    }
  });

  test('service worker 注册并进入 activated 状态', async ({ page }) => {
    await page.goto('');

    const state = await page.evaluate(async () => {
      // 注册脚本由 vite-plugin-pwa 注入，是异步的 —— 给它一点时间
      const registration = await navigator.serviceWorker.ready;

      return {
        scope: registration.scope,
        hasActive: registration.active !== null,
      };
    });

    expect(state.hasActive, 'service worker 应已激活').toBe(true);
    expect(state.scope).toContain('/resume/');
  });

  test('apple-touch-icon 与 favicon 可访问', async ({ page, request }) => {
    await page.goto('');

    for (const rel of ['icon', 'apple-touch-icon']) {
      const href = await page.locator(`head link[rel="${rel}"]`).getAttribute('href');
      expect(href, `应声明 ${rel}`).not.toBeNull();

      const response = await request.get(href as string);
      expect(response.status(), `${rel} 指向的文件应可访问`).toBe(200);
    }
  });

  test('sitemap 与 robots.txt 可访问且格式正确', async ({ request }) => {
    const sitemap = await request.get('/resume/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toMatch(/xml/);

    const xml = await sitemap.text();
    expect(xml).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(xml).toContain('https://fangmuyang.github.io/resume/');

    const robots = await request.get('/resume/robots.txt');
    expect(robots.status()).toBe(200);

    const text = await robots.text();
    expect(text).toMatch(/User-agent:\s*\*/);
    expect(text).toContain('https://fangmuyang.github.io/resume/sitemap.xml');
  });
});
