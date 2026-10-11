/**
 * 生成 PWA 所需的全部图标。
 *
 *   pnpm icons
 *
 * ## 为什么不用 @vite-pwa/assets-generator
 *
 * 那个官方工具依赖 `sharp`（原生图像库），它需要下载平台专用的预编译二进制。
 * 在没有网络出站权限的环境里安装会挂住。而图标本身很简单
 * （圆角方底 + 一个字母），用 Python 的 Pillow 直接画更可控：
 *
 * - 没有原生依赖，装好 Pillow 就能跑；
 * - 生成逻辑就是代码本身，参数（内边距、圆角半径）一目了然；
 * - 想做视觉调整时改几行即可，不必去查工具链的配置项。
 *
 * 换来的代价是“图标设计”也被写进了代码 —— 但对一个单字母图标来说，
 * 这反而比维护一个 SVG 源文件加一条生成链更简单。
 *
 * ## 图标清单与用途
 *
 * | 文件 | 尺寸 | 用途 |
 * | --- | --- | --- |
 * | pwa-192x192.png | 192 | Android 主屏图标（安装性要求的最小尺寸） |
 * | pwa-512x512.png | 512 | 启动画面、应用商店 |
 * | maskable-512x512.png | 512 | Android 自适应图标（四周留白，会被系统裁切） |
 * | apple-touch-icon.png | 180 | iOS 主屏图标（不支持透明，必须不透明底） |
 * | favicon.ico | 16/32/48 | 传统浏览器兜底 |
 *
 * ## maskable 为什么必须单独一张
 *
 * Android 会对 maskable 图标做裁切，只保留中间约 80% 的安全区域。
 * 直接拿普通图标当 maskable 用，边缘内容会被切掉。
 * 所以 maskable 版本要把图形**缩小并居中**（下面 SAFE_ZONE 就是为此）。
 */
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(here);
const repoRoot = dirname(projectRoot);
const publicDir = join(projectRoot, 'public');

/** 与 src/styles/index.css 里的品牌色保持一致 */
const BRAND_START = '#4f46e5';
const BRAND_END = '#7c3aed';

/**
 * Python 脚本通过环境变量接收参数，避免把路径拼进源码字符串 ——
 * Windows 的反斜杠在字符串里需要转义，很容易出错。
 */
const PYTHON_SCRIPT = `
import os
from PIL import Image, ImageDraw

out_dir = os.environ["ICON_OUT_DIR"]
brand_start = os.environ["ICON_BRAND_START"].lstrip("#")
brand_end = os.environ["ICON_BRAND_END"].lstrip("#")

def hex_to_rgb(value):
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))

start_rgb = hex_to_rgb(brand_start)
end_rgb = hex_to_rgb(brand_end)


def make_gradient(size):
    """生成对角线性渐变。

    逐行构造像素数据再一次性建图，而不是用 draw.rectangle 逐列画 ——
    后者在超采样尺寸下会画上万次，而且容易被后续操作覆盖（第一版就踩了这个坑：
    图标生成了，但看起来是纯色）。
    """
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            # 对角线方向的插值：左上 -> 右下
            t = (x + y) / (2 * (size - 1))
            pixels[x, y] = tuple(
                int(start_rgb[i] + (end_rgb[i] - start_rgb[i]) * t) for i in range(3)
            )
    return image


def draw_glyph(image, size, glyph_ratio):
    """画字母 F，按外接矩形在画布上居中。

    第一版把字形当成"从顶部开始往下排"来定位，结果视觉上偏下 ——
    因为 F 的实际墨迹高度不等于外接矩形高度。
    改成按整体外接矩形的几何中心对齐。
    """
    glyph_height = size * glyph_ratio
    stroke = glyph_height * 0.22
    glyph_width = glyph_height * 0.66

    left = (size - glyph_width) / 2
    top = (size - glyph_height) / 2

    draw = ImageDraw.Draw(image)
    white = (255, 255, 255, 255)
    # 竖干（占满高度）
    draw.rectangle([left, top, left + stroke, top + glyph_height], fill=white)
    # 上横
    draw.rectangle([left, top, left + glyph_width, top + stroke], fill=white)
    # 中横：位置取竖干的中部偏上，与常见无衬线字体的 F 接近
    middle_y = top + glyph_height * 0.42
    draw.rectangle(
        [left, middle_y, left + glyph_width * 0.78, middle_y + stroke], fill=white
    )


def make_icon(size, radius_ratio, glyph_ratio):
    """radius_ratio 为 0 表示正方形（maskable 与 iOS 由系统自己加圆角）。"""
    scale = 4
    canvas = size * scale

    # 先铺满不透明底色：图标不应有透明边缘（iOS 会把透明填黑）
    background = make_gradient(canvas).convert("RGBA")

    if radius_ratio > 0:
        mask = Image.new("L", (canvas, canvas), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, canvas - 1, canvas - 1], radius=int(canvas * radius_ratio), fill=255
        )
        background.putalpha(mask)

    draw_glyph(background, canvas, glyph_ratio)

    return background.resize((size, size), Image.LANCZOS)


targets = [
    ("pwa-192x192.png", 192, 0.22, 0.58),
    ("pwa-512x512.png", 512, 0.22, 0.58),
    # maskable：正方形 + 图形缩到 0.42，确保落在 80% 安全区内
    ("maskable-512x512.png", 512, 0.0, 0.42),
    # iOS 不接受透明，且系统自己切圆角
    ("apple-touch-icon.png", 180, 0.0, 0.55),
]

for name, size, radius_ratio, glyph_ratio in targets:
    make_icon(size, radius_ratio, glyph_ratio).save(os.path.join(out_dir, name), "PNG")
    print("generated " + name)

favicon_sizes = [16, 32, 48]
frames = [make_icon(s, 0.22, 0.58) for s in favicon_sizes]
frames[0].save(
    os.path.join(out_dir, "favicon.ico"),
    format="ICO",
    sizes=[(s, s) for s in favicon_sizes],
)
print("generated favicon.ico")
`;

/** 找到可用的 Python：优先项目约定的 python，回退到 PATH 里的 python */
function resolvePython(): string {
  const candidates = [process.env['DSH_PYTHON'], 'python', 'python3'].filter(
    (value): value is string => value !== undefined && value !== '',
  );

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'import PIL'], { stdio: 'inherit' });
    if (probe.status === 0) return candidate;
  }

  throw new Error(
    '找不到带 Pillow 的 Python。请安装 Pillow（pip install Pillow），或设置 DSH_PYTHON 环境变量。',
  );
}

function main(): void {
  const python = resolvePython();

  const result = spawnSync(python, ['-c', PYTHON_SCRIPT], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ICON_OUT_DIR: publicDir,
      ICON_BRAND_START: BRAND_START,
      ICON_BRAND_END: BRAND_END,
    },
  });

  if (result.status !== 0) {
    throw new Error(`图标生成失败（Python 退出码 ${String(result.status)}）`);
  }

  console.log(`\n图标已输出到 ${relative(repoRoot, publicDir)}/`);
}

main();
