/**
 * lint-staged 配置。
 * 只对本次 git add 的文件跑检查，所以提交时的等待时间是常数级的，
 * 不会随项目变大而变慢 —— 这是它相对于"提交前跑全量 lint"的核心优势。
 *
 * 注意：本配置写在仓库根，而业务代码在 site/。
 * 命令里显式指定 site/ 前缀，避免跑到仓库根去找不存在的 ESLint 配置。
 */
export default {
  'site/**/*.{ts,tsx}': ['pnpm --dir site exec eslint --fix --max-warnings 0', 'prettier --write'],
  'site/**/*.{css,json,md,html}': ['prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
