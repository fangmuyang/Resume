import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 配置。
 *
 * ## E2E 在这里补的是哪块空缺
 *
 * 单测（Vitest + jsdom）覆盖了逻辑分支，但有几个关键行为**在 jsdom 里测不到**，
 * 而且项目开发过程中一直没能验证：
 *
 * | 行为 | 为什么 jsdom 测不到 |
 * | --- | --- |
 * | 暗黑模式刷新后保持 | 需要真实的 localStorage 持久化与页面重载 |
 * | 移动端无横向滚动 | 需要真实的布局计算与视口尺寸 |
 * | 首屏不闪白（FOUC） | 需要真实的样式加载与绘制时序 |
 * | 路由子路径刷新不 404 | 需要真实 HTTP 服务器与 SPA 回退 |
 * | 键盘可达性与焦点管理 | 需要真实浏览器的事件与焦点模型 |
 *
 * ## 为什么要指定 `baseURL` 带子路径
 *
 * 站点的生产 `base` 是 `/resume/`（GitHub Pages 项目站点）。
 * 让 E2E 直接跑在这个前缀下，等于**顺带验证了子路径部署**这件事 ——
 * 而它是整个部署环节最容易出错的地方。
 */
const PORT = 4173;
const BASE_PATH = '/resume/';

export default defineConfig({
  testDir: './e2e',

  // 用例之间共享同一个构建产物，串行执行避免互相干扰
  fullyParallel: false,
  workers: 1,

  // CI 上禁止遗留 .only 并增加重试，本地则快速失败
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,

  reporter: process.env['CI'] === undefined ? 'list' : [['github'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      /**
       * 移动端项目：这是**验证响应式布局的唯一可靠方式**。
       * 用真实设备参数（视口、DPR、触摸、UA）而不是只改窗口宽度 ——
       * 只改宽度测不到移动端的触摸行为与 UA 相关的分支。
       */
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],

  /**
   * 用 `vite preview` 提供**生产构建产物**，而不是 `vite dev`。
   *
   * 原因：dev server 不做资源哈希、不做代码分割、不做 base 前缀处理 ——
   * 而这三件事恰恰是部署环节最容易出问题的地方。
   * 测生产产物才能真正验证"部署后能不能用"。
   */
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}${BASE_PATH}`,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  },
});
