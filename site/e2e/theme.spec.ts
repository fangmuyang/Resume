import { expect, test } from '@playwright/test';

/**
 * 主题（暗黑模式）E2E。
 *
 * ## 这组用例补的是一个长期缺口
 *
 * 阶段 2 实现了"防 FOUC + 主题持久化"，但当时**无法验证** ——
 * 开发沙箱起不了服务器，也没有浏览器。当时只能做产物级检查
 * （确认引导脚本存在于 index.html），而那是必要条件、不是充分条件。
 *
 * 下面这几件事只有真实浏览器能验证：
 * - 引导脚本是否真的在首屏绘制**之前**执行（防 FOUC）；
 * - localStorage 持久化是否真的跨刷新生效；
 * - `prefers-color-scheme` 是否真的被尊重。
 */

/** 读取 <html> 上的 dark 类 */
async function isDarkMode(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

test.describe('暗黑模式', () => {
  test('点击切换按钮后进入暗色模式', async ({ page }) => {
    // 明确指定浅色偏好，避免 CI 环境的系统设置影响结果
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('');

    expect(await isDarkMode(page), '初始应为浅色').toBe(false);

    await page.getByRole('button', { name: /切换到深色模式/ }).click();
    await expect.poll(async () => isDarkMode(page), { message: '点击后应进入暗色模式' }).toBe(true);
  });

  test('刷新后主题保持（localStorage 持久化）', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('');

    await page.getByRole('button', { name: /切换到深色模式/ }).click();
    await expect.poll(async () => isDarkMode(page)).toBe(true);

    // 关键：重新加载页面
    await page.reload();

    // 这是阶段 2 引入 localStorage + 引导脚本的目的 ——
    // 刷新后不应该回到浅色
    expect(await isDarkMode(page), '刷新后应保持暗色').toBe(true);

    // 顺带确认选择的确实被写进了 localStorage
    const stored = await page.evaluate(() => localStorage.getItem('resume-site-theme'));
    expect(stored).toBe('dark');
  });

  test('再次切换能回到浅色并保持', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('');

    await page.getByRole('button', { name: /切换到深色模式/ }).click();
    await expect.poll(async () => isDarkMode(page)).toBe(true);

    await page.getByRole('button', { name: /切换到浅色模式/ }).click();
    await expect.poll(async () => isDarkMode(page)).toBe(false);

    await page.reload();
    expect(await isDarkMode(page), '刷新后应保持浅色').toBe(false);
  });

  test('没有存储偏好时跟随系统设置', async ({ page }) => {
    // 系统偏好为暗色，且 localStorage 为空 → 应该以暗色启动
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('');

    await page.evaluate(() => localStorage.removeItem('resume-site-theme'));
    await page.reload();

    expect(await isDarkMode(page), '应跟随系统的暗色偏好').toBe(true);
  });

  test('首屏不闪白（引导脚本在绘制前生效）', async ({ page }) => {
    /**
     * 这是**防 FOUC 的核心验证**，也是最能体现 E2E 价值的一条。
     *
     * 思路：先把用户偏好设为暗色，然后重新加载页面，
     * 并在页面加载的极早期（脚本开始执行之前）就注入一个 MutationObserver，
     * 记录 <html> 的 class 变化历史。
     *
     * 如果主题是在 React 挂载后才设置的，那么 html 会先经历一段
     * "没有 dark 类"的状态 —— 那段时间就是用户看到的白屏闪烁。
     *
     * 注意这里**不用 emulateMedia**：系统偏好为浅色，但用户显式选了暗色。
     * 这种情况下引导脚本必须读 localStorage 而不是系统偏好。
     */
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('');
    await page.evaluate(() => localStorage.setItem('resume-site-theme', 'dark'));

    // addInitScript 会在页面的任何脚本（包括内联的引导脚本）之前执行
    await page.addInitScript(() => {
      const history: string[] = [];
      const record = (): void => {
        history.push(document.documentElement.className);
      };

      // 尽早记录初始状态，并用观察器捕捉后续变化
      document.addEventListener('readystatechange', record);
      new MutationObserver(record).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });

      // 暴露给测试读取
      (window as unknown as { __classHistory: string[] }).__classHistory = history;
    });

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const history: string[] = await page.evaluate(
      () => (window as unknown as { __classHistory: string[] }).__classHistory ?? [],
    );

    /**
     * 断言：一旦 <html> 被记录到，它就应该**已经带着 dark 类**。
     *
     * 换句话说，"曾经出现过没有 dark 类的 html" 就意味着闪烁。
     * 引导脚本是阻塞式内联脚本，应该在首次绘制前就加好类，
     * 所以历史里不应出现空 class 的记录。
     */
    const recordsWithoutDark = history.filter((className) => !className.includes('dark'));

    expect(
      recordsWithoutDark,
      `引导脚本未能在绘制前设置主题，class 变化历史：${JSON.stringify(history)}`,
    ).toEqual([]);
  });
});
