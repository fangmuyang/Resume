/**
 * Conventional Commits 规范校验。
 * 提交信息格式：<type>(<scope>): <subject>
 * 例：feat(router): 接入 React Router 并实现六条路由
 *
 * 为什么要机器校验：提交历史是可读的项目文档。
 * "fix bug" 这类信息三个月后对自己也毫无价值。
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 允许的提交类型（在规范的基础上收窄，贴合本项目）
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复缺陷
        'docs', // 仅文档变更
        'style', // 不影响语义的格式变更
        'refactor', // 重构（既非新功能也非修复）
        'perf', // 性能优化
        'test', // 增删改测试
        'build', // 构建系统或依赖变更
        'ci', // CI 配置与脚本
        'chore', // 其他杂项
        'revert', // 回滚提交
      ],
    ],
    // scope 可省略，但写了必须是这几个之一，防止出现五花八门的模块名
    'scope-enum': [
      2,
      'always',
      [
        'deps', // 依赖
        'tooling', // 工程规范：ESLint/Prettier/Husky/TS 配置
        'content', // 内容管道与内容数据
        'router', // 路由
        'ui', // 组件与设计系统
        'theme', // 主题与暗黑模式
        'pages', // 页面
        'search', // 搜索
        'forms', // 表单
        'api', // 数据请求
        'test', // 测试
        'a11y', // 可访问性
        'seo', // SEO / PWA
        'ci', // 流水线
        'deploy', // 部署
        'docs', // 文档
        'git', // 版本控制
      ],
    ],
    'subject-case': [0], // 中文标题不做大小写约束
    'header-max-length': [2, 'always', 100],
  },
};
