import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, Send, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  CONTACT_TOPIC_OPTIONS,
  contactFormSchema,
  type ContactFormValues,
} from '@/features/contact/contact-schema';
import { cn } from '@/lib/utils';

/**
 * 提交状态机。
 *
 * 用判别联合而不是 `isLoading` + `error` 两个独立布尔值：
 * 两个布尔值会出现"既在提交又有错误"这种不可能的状态，
 * 而联合类型从类型层面就排除了它 —— 每个分支只带自己需要的数据。
 */
type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

/**
 * 模拟提交。
 *
 * **本项目没有后端**，所以这里只是延迟一下并把提交记录写进 localStorage，
 * 让"提交成功"这个分支能被真实走通、而不是永远显示 loading。
 *
 * 真接后端时只需要替换这个函数，组件其余部分不用改 ——
 * 这正是不把副作用写在组件里的价值。
 */
async function submitContactForm(values: ContactFormValues): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    const key = 'contact-submissions';
    const previous: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');

    // 显式收窄成 unknown[]：直接 spread `any[]` 会让元素类型变成 any，
    // 触发 no-unsafe-assignment（TypeScript 的 Array.isArray 收窄结果是 any[]）
    const list: unknown[] = Array.isArray(previous) ? (previous as unknown[]) : [];

    // 只存非敏感字段：这是演示用的本地记录，不该当成收件箱
    localStorage.setItem(
      key,
      JSON.stringify([...list, { name: values.name, topic: values.topic, at: Date.now() }]),
    );
  } catch {
    // 隐私模式下 localStorage 可能不可用，但不该让用户看到失败
  }
}

export function ContactForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    // 首次提交前不打扰用户：输入过程中不报错，提交后才显示
    mode: 'onSubmit',
    defaultValues: { topic: 'job', website: '' },
  });

  const onSubmit = async (values: ContactFormValues): Promise<void> => {
    setSubmitState({ status: 'submitting' });

    try {
      await submitContactForm(values);
      setSubmitState({ status: 'success' });
      reset();
    } catch (error) {
      setSubmitState({
        status: 'error',
        message: error instanceof Error ? error.message : '提交失败，请稍后再试',
      });
    }
  };

  if (submitState.status === 'success') {
    return (
      <div className="grid justify-items-start gap-4 rounded-lg border border-emerald-500/40 bg-emerald-50/50 p-6 dark:bg-emerald-950/20">
        <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 aria-hidden className="size-5" />
          已收到你的消息
        </p>
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          这是演示站点，表单暂未连接后端。如需联系请直接发邮件，我会尽快回复。
        </p>
        <Button variant="outline" onClick={() => setSubmitState({ status: 'idle' })}>
          再写一条
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="你的称呼" error={errors.name?.message}>
          {/* autoComplete 让浏览器能正确自动填充，这也是无障碍的一部分 */}
          {(props) => <input {...props} {...register('name')} autoComplete="name" />}
        </Field>

        <Field id="contact-email" label="邮箱" error={errors.email?.message}>
          {(props) => <input {...props} {...register('email')} type="email" autoComplete="email" />}
        </Field>
      </div>

      <Field id="contact-topic" label="主题" error={errors.topic?.message}>
        {(props) => (
          <select {...props} {...register('topic')}>
            {CONTACT_TOPIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="contact-message" label="想说的话" error={errors.message?.message}>
        {(props) => <textarea {...props} {...register('message')} rows={6} />}
      </Field>

      {/*
        蜜罐字段：对用户隐藏但**不能**用 display:none ——
        部分机器人会跳过隐藏元素。用绝对定位移出可视区，
        并加 aria-hidden + tabIndex={-1} 让它对键盘与屏幕阅读器也不可见。
      */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">网站</label>
        <input id="contact-website" tabIndex={-1} {...register('website')} />
      </div>

      {submitState.status === 'error' ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-400/60 bg-red-50/60 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-400"
        >
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {submitState.message}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting || submitState.status === 'submitting'}>
          {isSubmitting ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden className="size-4" />
          )}
          {isSubmitting ? '发送中…' : '发送消息'}
        </Button>

        {/* aria-live 让屏幕阅读器在提交状态变化时播报，而不是静默等待 */}
        <p aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
          {submitState.status === 'submitting' ? '正在提交…' : ''}
        </p>
      </div>
    </form>
  );
}

interface FieldRenderProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
  className: string;
}

interface FieldProps {
  id: string;
  label: string;
  error: string | undefined;
  /**
   * 渲染实际的输入控件。
   *
   * 为什么用 render prop 而不是把 input/textarea/select 的分支写在 Field 里：
   * 三者的 props 与行为不同，硬塞进一个组件会变成一堆条件判断。
   * render prop 让 Field 只负责「标签 + 错误 + aria 关联」这件共同的事。
   */
  children: (props: FieldRenderProps) => React.ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  /**
   * 无障碍关联的关键两点：
   * 1. `aria-invalid` 让屏幕阅读器知道这个字段有错；
   * 2. `aria-describedby` 把错误文本与输入框关联起来 ——
   *    否则错误信息虽然可见，但读屏用户 focus 到输入框时听不到它。
   */
  const errorId = `${id}-error`;

  const props: FieldRenderProps = {
    id,
    'aria-invalid': error !== undefined,
    'aria-describedby': error !== undefined ? errorId : undefined,
    className: cn(
      'w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors dark:bg-slate-900',
      'focus-visible:ring-2 focus-visible:ring-brand-500',
      error !== undefined
        ? 'border-red-400 dark:border-red-500/60'
        : 'border-slate-200 dark:border-slate-800',
    ),
  };

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      {children(props)}

      {error !== undefined ? (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
