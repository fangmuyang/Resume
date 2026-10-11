/**
 * 主题状态的唯一真相来源。
 *
 * 设计要点（每一处都是踩坑换来的）：
 *
 * 1. **真正的真相在 `documentElement.className`**，不在 store 里。
 *    原因是首屏渲染前必须已经决定主题：如果等 React 挂载后再加 `.dark` 类，
 *    用户会先看到一瞬间的白色（FOUC）。所以 index.html 里有一段阻塞式脚本
 *    （见下方 THEME_INIT_SCRIPT）先根据 localStorage / 系统偏好定好类名，
 *    store 只是把这个既成事实读进来继续管理。
 *
 * 2. **区分「用户选择」与「系统偏好」**。
 *    theme 存用户明确选择（'light' | 'dark' | 'system'），
 *    resolvedTheme 才是实际生效的值。当用户选 system 时，
 *    要监听 prefers-color-scheme 变化并跟随。
 *
 * 3. 样式层开关用 Tailwind v4 的 @custom-variant，见 styles/index.css。
 */
import { create } from 'zustand';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'resume-site-theme';

/**
 * 必须与 index.html 里的内联脚本逻辑保持一致。
 * 抽成常量是为了让两边只差一个"字符串字面量"的差别，方便对照检查。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||((s===null||s==='system')&&m);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 读取首屏脚本已经写好的类名，而不是自己重新判断一遍 —— 避免两边逻辑分叉 */
function currentResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // 隐私模式下 localStorage 可能抛异常，降级为跟随系统
  }
  return 'system';
}

function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved: ResolvedTheme =
    choice === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : choice;

  document.documentElement.classList.toggle('dark', resolved === 'dark');

  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // 存不进去也不影响本次会话的主题生效
  }

  return resolved;
}

interface ThemeState {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
  /** 在 light / dark 之间切换；若当前是 system，则切到与系统相反的那个 */
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  choice: readStoredChoice(),
  resolved: currentResolvedTheme(),

  setChoice: (choice) => {
    set({ choice, resolved: applyTheme(choice) });
  },

  toggle: () => {
    const next: ThemeChoice = get().resolved === 'dark' ? 'light' : 'dark';
    get().setChoice(next);
  },
}));

/**
 * 让主题跟随系统变化（仅在用户选择 system 时生效）。
 * 返回取消订阅函数，方便在 effect 里清理。
 */
export function subscribeToSystemTheme(): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (): void => {
    const { choice, setChoice } = useThemeStore.getState();
    if (choice === 'system') setChoice('system');
  };

  media.addEventListener('change', handleChange);
  return () => media.removeEventListener('change', handleChange);
}
