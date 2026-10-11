/**
 * MSW server（Node 环境）。
 *
 * 与 handlers 分开文件的原因：handlers 描述"接口长什么样"，
 * server 描述"怎么把这个接口接管起来"。两者变化的原因不同 ——
 * 换测试运行器时要改 server，接口加字段时要改 handlers。
 *
 * 注意这里**不启用 `onUnhandledRequest`**：它由 setup.ts 在 listen 时指定。
 * 在 setup 里指定能让"严格程度"这件事集中在一个地方，便于整体调整。
 */
import { setupServer } from 'msw/node';

import { defaultHandlers } from '@/test/msw-handlers';

export const server = setupServer(...defaultHandlers);
