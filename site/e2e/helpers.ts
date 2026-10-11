import { expect, type Page } from '@playwright/test';

/**
 * E2E 共用的辅助函数。
 *
 * ## 为什么需要"打开导航"这一步
 *
 * 站点的导航在移动端与桌面端是两套不同的 DOM：
 * - 桌面：`<nav aria-label="主导航">` 直接可见；
 * - 移动端：主导航被 `md:flex` 隐藏，改用抽屉
 *   （按钮 `aria-label="打开菜单"` + `<nav aria-label="移动端导航">`）。
 *
 * 所以"点导航栏里的某个链接"在移动端**必须先打开抽屉**。
 * 第一版用例直接点"主导航"里的链接，桌面端通过、移动端全部超时 ——
 * 这不是布局 bug，而是测试没有覆盖两种形态。
 *
 * 把这段判断集中在这里，而不是在每个用例里写 `if (isMobile)`：
 * 后者会在多处重复，且很容易漏掉某一处。
 */
export async function openNavigation(page: Page): Promise<void> {
  const primaryNav = page.getByRole('navigation', { name: '主导航' });

  /**
   * 判断当前是哪种形态，用**实际可见性**而不是 `isMobile` 标志。
   *
   * 理由：`isMobile` 来自 project 配置，而"导航是否可见"才是这件事的
   * 真正依据。用可见性判断，将来改变断点也不会让辅助函数失效。
   */
  if (await primaryNav.isVisible()) return;

  const menuButton = page.getByRole('button', { name: '打开菜单' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  // 抽屉打开后再等导航出现，避免"点了立刻找链接"的竞态
  await expect(page.getByRole('navigation', { name: '移动端导航' })).toBeVisible();
}

/**
 * 点击导航链接并等待目标页面渲染完成。
 *
 * 返回实际被点击的那个导航容器，便于需要在里面继续查找的场景。
 */
export async function clickNavLink(page: Page, name: string): Promise<void> {
  await openNavigation(page);

  const mobileNav = page.getByRole('navigation', { name: '移动端导航' });
  const primaryNav = page.getByRole('navigation', { name: '主导航' });

  // 抽屉打开后用抽屉里的链接，否则用桌面导航
  const container = (await mobileNav.isVisible()) ? mobileNav : primaryNav;

  await container.getByRole('link', { name, exact: true }).click();
}

/** 页面主内容区的一级标题 —— 断言页面是否真的换过去了 */
export function mainHeading(page: Page) {
  return page.getByRole('main').getByRole('heading', { level: 1 });
}
