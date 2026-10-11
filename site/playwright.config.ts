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

/**
 * 用 `localhost` 而不是 `127.0.0.1`。
 *
 * 这不是风格问题：`vite preview` 在没有 `--host` 时只绑定 IPv6 回环（`::1`），
 * 而 `127.0.0.1` 是 IPv4 地址。写成后者会得到
 * "无法连接到远程服务器"，看起来像"服务器没起来"，
 * 实际是地址族不匹配 —— 很容易在这上面浪费大量时间（本项目就踩过一次）。
 *
 * `localhost` 会按系统解析顺序同时覆盖两者，所以更稳妥。
 */
const HOST = 'localhost';

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
    baseURL: `http://${HOST}:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      /**
       * 用系统已安装的 Chrome，而不是 Playwright 自带的 Chromium。
       *
       * 两个原因：
       * 1. 本项目的开发环境**下载不了** Playwright 的浏览器二进制
       *    （受限网络，与 sharp 的问题同类）；
       * 2. 对个人站点来说，用真实用户的浏览器版本测试更接近实际 ——
       *    Chrome 的稳定版就是访客在用的那个。
       *
       * 需要本机装有 Chrome（macOS / Linux / Windows 都常见）。
       * CI 上如果没装，改回 `browserName: 'chromium'` 并运行
       * `pnpm test:e2e:install` 即可。
       */
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      /**
       * 移动端项目：这是**验证响应式布局的唯一可靠方式**。
       * 用真实设备参数（视口、DPR、触摸、UA）而不是只改窗口宽度 ——
       * 只改宽度测不到移动端的触摸行为与 UA 相关的分支。
       */
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],

  /**
   * 用 `vite preview` 提供**生产构建产物**，而不是 `vite dev`。
   *
   * 原因：dev server 不做资源哈希、不做代码分割、不做 base 前缀处理 ——
   * 而这三件事恰恰是部署环节最容易出问题的地方。
   * 测生产产物才能真正验证"部署后能不能用"。
   *
   * ## `--base` 必须显式传
   *
   * `vite preview` 的 `base` 默认是 `/`，而构建产物里的资源路径是
   * `/resume/assets/...`。不传这个参数时，服务器会在根路径下找
   * `/assets/...`，于是**每一个 JS 都 404、页面完全空白**。
   *
   * 这个坑很隐蔽：`vite build` 成功、`verify:build` 也通过
   * （它检查的是产物文件里的路径），但用 preview 打开就是白屏。
   * 本项目的 E2E 第一次真正跑起来时就撞上了它 ——
   * 这正是"必须用真实浏览器验证"的价值所在。
   */
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --base ${BASE_PATH}`,
    url: `http://${HOST}:${PORT}${BASE_PATH}`,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 120_000,
  },
});
