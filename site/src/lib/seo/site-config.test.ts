/**
 * 部署配置推导的单元测试。
 *
 * ## 为什么这个文件值得存在
 *
 * `toAbsoluteUrl` 看起来是个简单的字符串拼接，但它是本项目里
 * **我算错过最多次的一处** —— 而且每次错都不会报错：
 *
 * 1. 改成"从同一个变量推导 base"时，把它与 `BASE_PREFIX` 拼了两次，
 *    生成出 `…/resume/resume/`；
 * 2. 排查时又在一处临时命令里把正则的 `$` 转义成了 `\$`，
 *    于是"去掉尾部斜杠"的替换静默失效 —— 我得打印出真实值才看出问题；
 * 3. `build-seo.ts` 里还维护了一份**独立的**重复实现，
 *    两份实现分了叉。
 *
 * 这些问题的共同点是：**只在生成出来的文件内容里才看得出来**，
 * 构建、类型检查、其他守卫全都通过。
 *
 * 教训是"同一件事只留一份实现"，并且给这份实现配单测。
 * 这个文件的全部价值就是把"绝对地址到底长什么样"固定下来。
 */
import { describe, expect, it } from 'vitest';

import {
  BASE_PATH,
  BASE_PREFIX,
  SITE_ORIGIN,
  deriveSiteConfig,
  toAbsoluteUrl,
} from '@/lib/seo/site-config';

/**
 * ## 两种部署形态的推导
 *
 * 这组用例是本次改动里最有价值的部分：它把"站点地址 → 资源前缀"的推导
 * 固定下来，而这个推导我之前算错过多次，每次都只在生成出来的文件内容里
 * 才看得出来（`…/resume/resume/`）。
 */
describe('deriveSiteConfig', () => {
  it('GitHub Pages 项目站点：前缀是仓库名', () => {
    const config = deriveSiteConfig('https://fangmuyang.github.io/resume');

    expect(config.origin).toBe('https://fangmuyang.github.io/resume');
    expect(config.basePath).toBe('/resume');
    expect(config.basePrefix).toBe('/resume/');
  });

  it('自定义域名：前缀是根', () => {
    /**
     * 这是最容易出错的一种：域名根就是站点根。
     * 若这里推导出 `/resume`，部署后所有资源都会 404、整站白屏。
     */
    const config = deriveSiteConfig('https://fangmu.online');

    expect(config.origin).toBe('https://fangmu.online');
    expect(config.basePath).toBe('');
    expect(config.basePrefix).toBe('/');
  });

  it('自定义域名的子路径部署', () => {
    // 少见的形态，但推导逻辑应当同样成立
    const config = deriveSiteConfig('https://example.com/site');

    expect(config.basePath).toBe('/site');
    expect(config.basePrefix).toBe('/site/');
  });

  it('去掉尾部斜杠，避免出现重复斜杠', () => {
    expect(deriveSiteConfig('https://fangmu.online/').origin).toBe('https://fangmu.online');
    expect(deriveSiteConfig('https://example.com/site///').basePath).toBe('/site');
  });

  it('忽略 query 与 hash', () => {
    // 环境变量里带上这些很少见，但一旦出现，路径推导会被污染
    expect(deriveSiteConfig('https://example.com/site?x=1').basePath).toBe('/site');
    expect(deriveSiteConfig('https://example.com/site#a').basePath).toBe('/site');
  });

  it('http 协议同样支持', () => {
    expect(deriveSiteConfig('http://localhost:4173').basePath).toBe('');
  });
});

/**
 * 默认配置是 GitHub Pages 项目站点，
 * 站点地址 `https://fangmuyang.github.io/resume`，前缀 `/resume/`。
 *
 * 测试依赖这个默认值 —— 这是刻意的：如果默认值被改，
 * 这些用例会失败并提醒我们检查 sitemap / canonical 是否仍然正确。
 */
describe('默认部署配置（GitHub Pages 项目站点）', () => {
  it('SITE_ORIGIN 含基础路径', () => {
    expect(SITE_ORIGIN).toBe('https://fangmuyang.github.io/resume');
  });

  it('BASE_PATH 不含尾部斜杠', () => {
    expect(BASE_PATH).toBe('/resume');
  });

  it('BASE_PREFIX 含尾部斜杠', () => {
    expect(BASE_PREFIX).toBe('/resume/');
  });
});

describe('toAbsoluteUrl', () => {
  it('根路径保留一个尾部斜杠', () => {
    expect(toAbsoluteUrl('/')).toBe('https://fangmuyang.github.io/resume/');
  });

  it('空字符串等同于根路径', () => {
    expect(toAbsoluteUrl('')).toBe('https://fangmuyang.github.io/resume/');
  });

  it('普通路由不带尾部斜杠', () => {
    expect(toAbsoluteUrl('/about')).toBe('https://fangmuyang.github.io/resume/about');
  });

  it('不带前导斜杠的路径也能正确处理', () => {
    expect(toAbsoluteUrl('about')).toBe('https://fangmuyang.github.io/resume/about');
  });

  it('深层路由正常拼接', () => {
    expect(toAbsoluteUrl('/posts/build-time-validation-in-vite')).toBe(
      'https://fangmuyang.github.io/resume/posts/build-time-validation-in-vite',
    );
  });

  it('不会重复基础路径', () => {
    /**
     * 这是最关键的一条：`SITE_ORIGIN` 已经含 `/resume`，
     * 若再拼一次 `BASE_PREFIX` 就会得到 `…/resume/resume/about`。
     * 那种错误不会让任何检查失败，只会在生成的文件里静默出现。
     */
    const result = toAbsoluteUrl('/about');

    expect(result).not.toContain('/resume/resume');
    // 用出现次数断言比 toContain 更严格：整个地址里 `/resume` 只该出现一次
    expect(result.split('/resume').length - 1).toBe(1);
  });

  it('多余的尾部斜杠会被去掉', () => {
    expect(toAbsoluteUrl('/about/')).toBe('https://fangmuyang.github.io/resume/about');
  });

  it('多个前导斜杠不会产生空段', () => {
    expect(toAbsoluteUrl('//about')).toBe('https://fangmuyang.github.io/resume/about');
  });
});
