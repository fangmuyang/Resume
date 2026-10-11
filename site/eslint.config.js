// ESLint 9 的扁平配置（flat config）。
// 相比旧的 .eslintrc，它是一个普通的 ES 模块数组，没有隐式的 extends/overrides，
// 每一层规则从哪来、作用于哪些文件都一目了然。
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ---------- 0) 忽略产物与生成内容 ----------
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'public',
      'src/content/generated',
    ],
  },

  // ---------- 1) 所有文件：不依赖类型信息的推荐规则 ----------
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---------- 2) 工具配置文件：Node 环境，不启用类型感知规则 ----------
  // 原因：vite.config.ts / eslint.config.js 不在业务 tsconfig 的 project 范围内，
  // 类型感知规则会报 "was not found by the project service"。
  // 这不是绕过检查，而是把它们交给合适的检查范围。
  {
    files: ['**/*.config.js', '**/*.config.ts', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // ---------- 3) src/：浏览器环境 + 完整类型感知规则 ----------
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // 学习项目里最有价值的一条：禁止 any 泄漏，逼你写真实类型
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // 显式标记纯类型导入，减少不必要的运行时产物
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // 未使用变量：允许以 _ 开头的占位参数
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
