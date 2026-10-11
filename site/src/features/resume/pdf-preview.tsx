/**
 * PDF 预览组件。
 *
 * ## 为什么用 pdfjs 自己渲染，而不是 <iframe>
 *
 * 最省事的做法是 `<iframe src="/resume.pdf">`，让浏览器内置查看器处理。
 * 但那会带来几个问题：
 *
 * 1. **外观不可控** —— 每个浏览器/系统的工具栏都不一样，
 *    在暗色主题里还会突然出现一块刺眼的白色面板；
 * 2. **移动端行为不一致** —— iOS Safari 与 Android Chrome 差别很大，
 *    有的直接下载、有的全屏、有的内联；
 * 3. **无法与页面交互** —— 想加"点击放大"这类能力都做不到。
 *
 * pdfjs 自己渲染到 canvas 就没有这些问题，代价是产物里多一个 PDF 引擎
 * （所以本组件的引擎是动态导入的，只在用户展开预览时才下载）。
 *
 * ## worker 是这里最容易踩的坑
 *
 * pdfjs 把解析工作放在 Web Worker 里。worker 脚本必须能被浏览器**单独加载**，
 * 不能像普通模块那样被打进主包。三种常见做法的取舍：
 *
 * - 指向第三方 CDN —— 离线不可用，也有供应链风险；
 * - 手工把 `pdf.worker.mjs` 复制到 `public/` —— 可行，但升级依赖时容易忘同步；
 * - **用 Vite 的 `?url` 导入**（本组件的做法）—— 构建时自动产出带 hash 的
 *   worker 文件并给出正确 URL，升级依赖不会失效，也不会被 CDN 拖累。
 */
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { resolveAssetUrl } from '@/lib/projects';

export interface PdfPreviewProps {
  /** public/ 下的 PDF 文件名 */
  file: string;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; pageCount: number }
  | { status: 'error'; message: string };

export function PdfPreview({ file }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  // url 只由 props 决定，渲染期就能算出来。
  // 因此"地址无效"是**派生**状态，不需要放进 state、也不需要 effect ——
  // 在 effect 里同步 setState 会触发级联渲染
  // （ESLint 的 react-hooks/set-state-in-effect 会直接报错）。
  const url = resolveAssetUrl(file);

  useEffect(() => {
    // 地址无效时不进入加载流程；渲染分支会直接给出提示
    if (url === null) return;

    // 组件卸载或 URL 变化后不再 setState，避免在已卸载的组件上更新状态
    let cancelled = false;

    async function render(): Promise<void> {
      try {
        // 动态导入：PDF 引擎体积不小，只在真正需要预览时才下载
        const pdfjs = await import('pdfjs-dist');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;

        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const doc = await pdfjs.getDocument({ url: url ?? '' }).promise;

        if (cancelled) return;

        setState({ status: 'ready', pageCount: doc.numPages });

        const canvas = canvasRef.current;
        if (canvas === null) return;

        // 只渲染第一页作为预览：这份简历本来就是一页，
        // 而且多页渲染会显著增加内存占用
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        // devicePixelRatio 决定画布的真实像素尺寸。
        // 不乘它的话，在高分屏上文字会明显发虚 —— 这是 canvas 渲染的经典坑。
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const context = canvas.getContext('2d');
        if (context === null) return;

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          // 让 pdfjs 按设备像素比绘制，而不是我们自己放大位图（那样会糊）
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise;
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [url]);

  /**
   * 出错原因，没有错误时为 null。
   *
   * 抽成函数是为了让类型收窄只发生一次：直接写
   * `if (url === null || state.status === 'error')` 之后，
   * TS 无法在分支内同时收窄两个独立条件，`state.message` 会报错。
   */
  const errorReason = ((): string | null => {
    if (url === null) return '地址无效';
    return state.status === 'error' ? state.message : null;
  })();

  if (errorReason !== null) {
    return (
      <div className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-6 dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          无法在页面内预览 PDF（{errorReason}）。
        </p>
        {url !== null ? (
          <div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-600 dark:text-brand-500 text-sm underline-offset-4 hover:underline"
            >
              在新标签页打开
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        {state.status === 'loading' ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            正在加载 PDF…
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          // 画布内容对屏幕阅读器没有意义，用文字说明它代表什么
          role="img"
          aria-label="简历 PDF 第一页预览"
          className="mx-auto block max-w-full"
        />
      </div>

      {state.status === 'ready' && state.pageCount > 1 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          共 {state.pageCount} 页，此处预览第一页。完整内容请下载 PDF 查看。
        </p>
      ) : null}
    </div>
  );
}
