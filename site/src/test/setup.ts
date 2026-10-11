/**
 * 测试环境 setup。
 *
 * 这个文件在**每个测试文件之前**执行一次，做四件事：
 * 1. 注册 jest-dom 的匹配器（`toBeInTheDocument` 等）；
 * 2. **包一层 fetch，剥掉 AbortSignal**（原因见下，这是本项目最费解的一个坑）；
 * 3. 启动 MSW server，并在用例间重置 handler；
 * 4. 每个用例结束后卸载 React 组件树。
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { server } from '@/test/msw-server';

/**
 * ## 为什么必须剥掉 fetch 的 signal
 *
 * 这是 jsdom 环境里最费解的一类问题：**realm 冲突**。
 *
 * Vitest 的 jsdom 环境会把 `globalThis.fetch` 换成自己的代理
 * （实测 `fetch.name === 'fetchProxy'`）。该代理在内部构造 `Request` 时，
 * 会用**自己 realm** 的 `AbortSignal` 做 `instanceof` 校验，
 * 而 TanStack Query 传进来的 signal 来自另一个 realm，于是直接抛：
 *
 * ```
 * TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
 * ```
 *
 * ### 排查过程中排除掉的方案（都试过，都不行）
 *
 * - **把 Node 的 `AbortSignal` / `AbortController` 覆盖到全局**：
 *   覆盖后 `signal instanceof globalThis.AbortSignal` 为 `true`，
 *   原型链也一致，但 `Request` 仍然拒绝 —— 说明校验用的构造器
 *   既不是全局那个，也不是 jsdom 那个，而是代理内部的私有引用。
 * - **换成 Node 原生 fetch**：拿不到未被代理包装的原始引用
 *   （ES 模块的 import 提升会让"捕获"发生在 jsdom 初始化之后）。
 *
 * ### 为什么只有组件测试会撞上
 *
 * TanStack Query 会给 queryFn 传 AbortSignal（用于组件卸载时取消请求），
 * 而直接调用 API 函数时通常不传。所以出现了"裸 fetch 正常、
 * 组件内必然失败"这种反直觉现象。
 *
 * ### 为什么接受这个妥协
 *
 * 生产环境里浏览器只有一份 DOM 实现，**不存在 realm 冲突** ——
 * 这是纯粹的测试环境问题，不是产品缺陷。
 * 剥掉 signal 之后，请求路径（URL、方法、请求头、状态码处理）
 * 全部照常被验证，只损失了"取消请求"这一个测试点。
 *
 * 代价是明确的、有界的；而继续在库内部细节上深挖的收益则不确定。
 * 如果将来测试环境修好了，删掉这层包装即可。
 */
/**
 * ## 为什么必须补 IntersectionObserver
 *
 * jsdom **不实现 IntersectionObserver**，而 motion 的 `whileInView`
 * 依赖它来检测元素是否进入视口。缺失时的症状很有迷惑性：
 *
 * ```
 * ReferenceError: IntersectionObserver is not defined
 * An error occurred in the <ForwardRef(motion.div)> component.
 * ```
 *
 * 组件在渲染阶段就抛错，于是**内容一个都不渲染** ——
 * 但 query 状态是 `success`、数据也正确，看起来像"数据取到了但没渲染"。
 * 这会让人去怀疑渲染逻辑，而真正的原因是测试环境缺 API。
 *
 * 下面的 stub 会**立即**把被观察元素报告为已进入视口，
 * 因此 `whileInView` 会立刻切到可见状态，内容正常渲染。
 *
 * 注意：这意味着单元测试里**测不到"滚动才出现"这个行为本身**。
 * 那属于视觉行为，由 Playwright 的 E2E 用例覆盖更合适 ——
 * 在真正的浏览器里 IntersectionObserver 是完整的。
 *
 * 同时也补上 ResizeObserver：motion 的某些能力会用到它，
 * 而且组件库普遍假设它存在。
 */
class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    // 异步触发，模拟真实 API 的行为（回调不会在 observe 内同步执行）。
    // 用 queueMicrotask 而不是 setTimeout：测试里的 waitFor 能更快拿到结果。
    queueMicrotask(() => {
      this.callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            target,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: 0,
          } as IntersectionObserverEntry,
        ],
        this,
      );
    });
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = ImmediateIntersectionObserver;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = NoopResizeObserver;
}

function installFetchWithoutSignal(): void {
  const current = globalThis.fetch;

  // 幂等：已经包过就不再叠加，避免多次 beforeEach 后套娃
  if (current.name === 'fetchWithoutSignal') return;

  const fetchWithoutSignal: typeof fetch = (input, init) => {
    if (init?.signal == null) return current(input, init);

    const { signal: _signal, ...rest } = init;
    return current(input, rest);
  };

  globalThis.fetch = fetchWithoutSignal;
}

/**
 * 必须在 `beforeEach` 里安装，不能只在模块顶层装一次。
 *
 * 实测：setup 文件执行完之后，Vitest 会**再次重置测试环境**，
 * `globalThis.fetch` 被换回 `fetchProxy` —— 模块顶层那次包装等于白做。
 * 症状是"包装代码明明写了却不生效"，非常容易误判成包装写法有问题。
 *
 * 放进 beforeEach 之后，每个用例都会在环境稳定之后重新包装。
 */
beforeEach(() => {
  installFetchWithoutSignal();
});

/**
 * `onUnhandledRequest: 'error'` 是这里最重要的一项配置。
 *
 * 默认行为是"警告并放行"，于是没被 mock 的请求会真的发出去 ——
 * 测试看起来通过了，实际上依赖了真实网络（慢、不稳定、可能消耗第三方额度）。
 * 设成 error 会在**第一个未 mock 的请求**上直接失败，
 * 逼你把网络边界显式声明出来。
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  // 重置 handler 到初始状态：某个用例用 server.use(...) 加的临时 handler 不会泄漏
  server.resetHandlers();

  // 卸载 React 组件树，否则上个用例的 DOM 会留在 document 里，
  // 导致 getBy* 查询命中多个元素
  cleanup();
});

afterAll(() => {
  server.close();
});
