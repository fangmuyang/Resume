import { cva, type VariantProps } from 'class-variance-authority';

/**
 * 按钮样式变体。
 *
 * 单独放在一个文件里，而不是和 Button 组件写在一起 ——
 * 这不是洁癖，而是为了让 Fast Refresh 正常工作：
 * React Refresh 要求一个模块「只导出组件」，如果同一个文件里既导出组件
 * 又导出常量，改这个文件时热更新会退化成整页刷新，开发体验明显变差。
 * （ESLint 的 react-refresh/only-export-components 规则就是在提醒这件事。）
 *
 * 用 cva 的价值在于把「有哪些变体」变成数据，并推导出 TS 联合类型，
 * 拼错变体名会在编译期报错。
 */
export const buttonVariants = cva(
  // 基础样式：所有变体共有
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-slate-950 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white hover:bg-brand-700',
        outline:
          'border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800',
        ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3',
        default: 'h-10 px-4 py-2',
        lg: 'h-11 px-6',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
