import { expect, test } from '@playwright/test';

/**
 * 响应式布局与可访问性 E2E。
 *
 * ## 为什么"移动端无横向滚动"必须用真实浏览器验证
 *
 * jsdom **不做布局计算** —— 所有元素的 `offsetWidth` 都是 0。
 * 所以"某个元素溢出视口导致横向滚动"这类问题在单测里完全测不到，
 * 而它恰恰是移动端最常见的体验问题。
 *
 * 这组用例在移动端项目（Pixel 7 参数）下运行时才有意义，
 * 下面的 `test.skip` 会把它们跳过 —— 因为桌面视口本来就宽，
 * 跑不出移动端特有的溢出问题。
 */

test.describe('响应式布局', () => {
  test('首屏没有横向滚动', async ({ page }, testInfo) => {
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // 允许 1px 的取整误差
    expect(
      overflow.scrollWidth - overflow.clientWidth,
      `视口 ${testInfo.project.name} 出现横向溢出：scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
    ).toBeLessThanOrEqual(1);
  });

  const routes = ['about', 'projects', 'posts', 'resume', 'contact'];

  for (const route of routes) {
    test(`/${route} 没有横向滚动`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, `/${route} 存在横向溢出 ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test('移动端显示抽屉按钮而非横向导航', async ({ page, isMobile }) => {
    test.skip(!isMobile, '仅在移动端项目下有意义');

    await page.goto('');

    // 桌面导航在移动端应被隐藏
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
    // 抽屉按钮应可见
    await expect(page.getByRole('button', { name: '打开菜单' })).toBeVisible();
  });

  test('移动端抽屉能打开、导航并自动收起', async ({ page, isMobile }) => {
    test.skip(!isMobile, '仅在移动端项目下有意义');

    await page.goto('');

    await page.getByRole('button', { name: '打开菜单' }).click();
    const mobileNav = page.getByRole('navigation', { name: '移动端导航' });
    await expect(mobileNav).toBeVisible();

    await mobileNav.getByRole('link', { name: '关于我' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('关于我');

    /**
     * 抽屉应自动收起。
     *
     * 阶段 2 这里踩过坑：最初用 effect 监听 pathname 来收起，
     * 被 ESLint 的 react-hooks/set-state-in-effect 拦下（会触发级联渲染）。
     * 改成用 `key={pathname}` 让组件在路由变化时重新挂载，
     * 状态自然回到初始值 —— 这个用例就是那条路线的验收。
     */
    await expect(mobileNav).toBeHidden();
  });
});

test.describe('可访问性', () => {
  test('页面有且仅有一个一级标题', async ({ page }) => {
    for (const path of ['', 'about', 'projects', 'posts', 'resume', 'contact']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });

  test('所有图片都有替代文本', async ({ page }) => {
    // 简历页的 PDF 预览会渲染 canvas（带 aria-label），
    // 这里检查的是真正的 <img>
    await page.goto('projects');

    const images = page.locator('img');
    const count = await images.count();

    for (let index = 0; index < count; index += 1) {
      const alt = await images.nth(index).getAttribute('alt');
      expect(alt, `第 ${index} 张图片缺少 alt`).not.toBeNull();
      expect(alt?.trim(), `第 ${index} 张图片的 alt 为空`).not.toBe('');
    }
  });

  test('键盘可以到达切换主题按钮并操作', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('');

    const toggle = page.getByRole('button', { name: /切换到深色模式/ });
    await toggle.focus();
    await expect(toggle).toBeFocused();

    await page.keyboard.press('Enter');

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
      .toBe(true);
  });

  test('焦点可见（不依赖鼠标）', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    /**
     * 先点一下页面再按 Tab。
     *
     * 原因：如果文档本身没有焦点，`keyboard.press('Tab')` 不会移动焦点，
     * `document.activeElement` 会停在 `<body>` 上 —— 而 body 的
     * `outline-style` 是 `none`，于是断言"聚焦元素应有可见轮廓"就会失败。
     *
     * 这个失败**看起来像无障碍缺陷，实际是测试步骤缺了一步**。
     * 真实用户总是先与页面交互（点击或按 Tab）才涉及键盘导航。
     *
     * 点击 `body` 而不是某个按钮：这样按 Tab 是从文档开头开始遍历。
     */
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    const focusedElements: { tag: string; hasOutline: boolean }[] = [];

    // 连续 Tab 几次，只要**有一个**元素有可见焦点环即算通过
    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Tab');

      const info = await page.evaluate(() => {
        const element = document.activeElement;
        if (element === null || element === document.body) {
          return { tag: 'BODY', hasOutline: false };
        }

        const style = window.getComputedStyle(element);
        const hasOutline = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';

        return { tag: element.tagName, hasOutline };
      });

      focusedElements.push(info);
      if (info.hasOutline) break;
    }

    expect(
      focusedElements.some((item) => item.hasOutline),
      `键盘遍历时应有可见焦点环，实际：${JSON.stringify(focusedElements)}`,
    ).toBe(true);
  });

  test('语言属性为中文', async ({ page }) => {
    await page.goto('');
    // <html lang> 影响屏幕阅读器的发音，是基础无障碍要求
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });
});
