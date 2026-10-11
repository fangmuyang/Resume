/**
 * 站点级导航结构。
 *
 * 把它抽成数据而不是散在 JSX 里，好处有两个：
 * 1. Header 的桌面导航与移动端抽屉共用同一份定义，不可能出现"加了一个页面只改了桌面导航"；
 * 2. 阶段 7 做站内搜索时，这份导航可以直接并入索引。
 */
export interface NavItem {
  to: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: '首页' },
  { to: '/about', label: '关于我' },
  { to: '/projects', label: '项目' },
  { to: '/posts', label: '笔记' },
  { to: '/resume', label: '简历' },
  { to: '/contact', label: '联系' },
];
