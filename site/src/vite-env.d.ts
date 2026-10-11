/// <reference types="vite/client" />

/**
 * Vite 环境变量的类型契约。
 *
 * ## 两条必须记住的规则
 *
 * **一、只有 `VITE_` 前缀的变量会被注入前端产物。**
 * 这是 Vite 的安全设计：没有前缀的变量（比如 `GITHUB_TOKEN`）留在 Node 侧，
 * 不会被意外打进浏览器。前缀是有意义的信息 —— 它表示"这个值会公开"。
 *
 * **二、`import.meta.env` 里的值都是字符串。**
 * 即使写成 `VITE_FOO=123`，读出来也是 `'123'`。
 * 需要数字时必须显式转换，否则 `if (count > 0)` 这类比较会得到意外结果
 * （字符串比较而非数值比较）。
 *
 * ## 关于令牌
 *
 * `VITE_GITHUB_TOKEN` 只是为了让本地开发时不容易撞上 API 限流。
 * **一旦构建产物发布，它就是公开的** —— 所以永远不要在 CI 里为公开部署注入它。
 * 真正的解决方案是让请求经过一个服务端代理，本项目没有后端，
 * 所以这里明确把"无令牌可用"当成一个需要优雅降级的产品状态来处理。
 */
interface ImportMetaEnv {
  /** GitHub 用户名，可在 .env.local 覆盖内容文件里的默认值 */
  readonly VITE_GITHUB_USERNAME?: string;
  /** 可选：提高接口限流额度。**不要**在公开部署时注入 */
  readonly VITE_GITHUB_TOKEN?: string;
  /**
   * 站点地址，同时决定资源前缀（Vite 的 `base`）。
   *
   * 默认 `https://fangmuyang.github.io/resume`（GitHub Pages 项目站点）。
   * 部署到自定义域名时设为域名本身，例如 `https://fangmu.online` ——
   * 此时资源前缀会变成 `/`，因为域名的根就是站点根。
   *
   * **这两件事必须同时改变**，所以由一个变量推导而不是两个独立配置项。
   */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
