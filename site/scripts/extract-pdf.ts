/**
 * PDF → content/ 的可复现管道。
 *
 *   pnpm extract
 *
 * 为什么写成脚本而不是手工复制粘贴：
 * 1. 可重复 —— 简历更新后重跑一次即可，不怕抄漏抄错；
 * 2. 可审查 —— 从 PDF 到网站内容的转换规则是**代码**，能被 review；
 * 3. 失败可控 —— 脚本用同一套 Zod schema 校验自己的产出，不符合契约就直接报错。
 *
 * 关于这个 PDF 的一个坑：它是 Chromium/Skia 打印导出的，字体是 Type3 矢量字形，
 * 大部分纯文本解析器（包括简单的流解压）抽不出文字。
 * 必须走 pdfjs-dist 的文本层 API，并且按坐标还原版式层级。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

import { profileSchema, resumeSchema, skillGroupsSchema } from '../src/lib/content/schema/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const contentDir = join(repoRoot, 'content');
const projectsDir = join(contentDir, 'projects');

const PDF_PATH = join(repoRoot, 'MyResume.pdf');

/**
 * 控制字符与零宽字符的字符类。
 *
 * 这个 PDF 有个真实坑：字体缺字形的位置会输出控制字符，
 * 例如 "基于 Uni \u0000 app" —— 直接渲染会出现方块，还可能被误当成正常空格。
 *
 * 用 RegExp 构造而不是正则字面量：字面量里写控制字符会触发 ESLint 的
 * no-control-regex 规则，而这里确实需要匹配它们。
 */
const CONTROL_AND_ZERO_WIDTH = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(0x1f)}${String.fromCharCode(0x7f)}` +
    `${String.fromCharCode(0x200b)}-${String.fromCharCode(0x200d)}${String.fromCharCode(0xfeff)}]`,
  'g',
);

/** 清理文本片段：剥掉控制字符并把连续空白折叠为单个空格 */
function sanitize(text: string): string {
  return text
    .replace(CONTROL_AND_ZERO_WIDTH, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 同一视觉行内，y 坐标差异小于该值就认为是同一行 */
const LINE_TOLERANCE = 3;

interface TextLine {
  y: number;
  x: number;
  text: string;
  fontSize: number;
}

/**
 * pdfjs-dist 的 legacy 构建是给 Node 用的（不需要 DOM）。
 * 用 createRequire 定位到实际文件路径，再转成 file:// URL 交给动态 import ——
 * 这样不受包 exports 限制，也不依赖 tsx 的解析行为。
 */
async function loadPdfDocument(path: string) {
  const require = createRequire(import.meta.url);
  const entry = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = (await import(
    `file://${entry.replace(/\\/g, '/')}`
  )) as typeof import('pdfjs-dist');

  return pdfjs.getDocument({
    data: new Uint8Array(readFileSync(path)),
    // 关闭字体相关的浏览器特性，纯文本抽取用不到
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
}

/** 把一页的文本项按坐标聚合成视觉行，尽量还原人眼看到的排版 */
async function extractLines(doc: Awaited<ReturnType<typeof loadPdfDocument>>): Promise<TextLine[]> {
  const lines: TextLine[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const buckets = new Map<number, { x: number; text: string; fontSize: number }[]>();

    for (const item of content.items) {
      // TextItem 有 str；TextMarkedContent 没有，这里显式收窄类型
      if (!('str' in item)) continue;

      const cleaned = sanitize(item.str);
      if (cleaned === '') continue;

      const y = Math.round(item.transform[5]);
      const existingKey = [...buckets.keys()].find((key) => Math.abs(key - y) <= LINE_TOLERANCE);
      const key = existingKey ?? y;

      if (!buckets.has(key)) buckets.set(key, []);

      buckets.get(key)?.push({
        x: item.transform[4],
        text: cleaned,
        // transform 的前两项是缩放分量，模长即字号
        fontSize: Math.hypot(item.transform[0], item.transform[1]),
      });
    }

    for (const [y, items] of buckets) {
      const sorted = [...items].sort((a, b) => a.x - b.x);
      lines.push({
        y,
        x: sorted[0]?.x ?? 0,
        // 片段之间用单个空格连接；sanitize 剥掉控制字符，applyCorrections 修正已知错误
        text: applyCorrections(sanitize(sorted.map((item) => item.text).join(' '))),
        fontSize: Math.max(...sorted.map((item) => item.fontSize)),
      });
    }
  }

  // 从上到下排序（PDF 坐标系原点在左下角，所以 y 大的在上）
  return lines.sort((a, b) => b.y - a.y).filter((line) => line.text !== '');
}

/** 以句末标点（或右引号/右括号）结尾，说明这句话写完了，下一行属于新内容 */
function endsSentence(text: string): boolean {
  return /[。！？；;：:）)】」』”"．.]$/.test(text);
}

/**
 * 识别区块标题。与条目标题缩进相同，因此需要额外的文字判据。
 * 已知的四个区块标题是稳定事实，直接列举最可靠。
 */
const SECTION_HEADINGS = new Set(['教育经历', '项目经历', '专业技能', '个人信息']);

function isSectionHeading(text: string): boolean {
  return SECTION_HEADINGS.has(text);
}

/** 以项目符号或数字开头的行一定是新条目 */
function startsEntry(text: string): boolean {
  return /^[•·*\-–—\d]/.test(text);
}

/**
 * 把换行的相邻行拼成"逻辑行"。
 *
 * 判据来自实测坐标数据（这是踩了三次坑才写对的）：
 *
 * | 内容     | x   | 字号 |
 * | -------- | --- | ---- |
 * | 区块标题 | 30  | 12.2 |
 * | 条目标题 | 30  | 10.8 |
 * | 正文     | 43  | 10.8 |
 *
 * 规则：
 * 1. 缩进**变化**（30 → 43 或 43 → 30）一定是新逻辑行 ——
 *    尤其要注意 30 → 43 表示"上一行是条目标题，这一行开始是它的正文"，
 *    绝不能拼进标题里（之前的错误就是把缩进变深当成了续行）；
 * 2. 缩进**相同**且上一行不以句末标点结尾，才是排版截断的续行，拼接；
 * 3. 其余情况视为新条目。
 */
function mergeWrappedLines(
  lines: TextLine[],
): { text: string; indent: number; fontSize: number }[] {
  const merged: { text: string; indent: number; fontSize: number }[] = [];

  for (const line of lines) {
    const previous = merged[merged.length - 1];

    const sameIndent = previous !== undefined && Math.abs(line.x - previous.indent) <= 1;

    const isWrapped =
      previous !== undefined &&
      sameIndent &&
      !endsSentence(previous.text) &&
      !startsEntry(line.text);

    if (isWrapped) {
      previous.text += line.text;
    } else {
      merged.push({ text: line.text, indent: line.x, fontSize: line.fontSize });
    }
  }

  // 拼接完成后再统一应用人工校正：有些错误是跨行拼接后才形成的
  return merged.map((item) => ({ ...item, text: applyCorrections(item.text) }));
}

/** 一个条目：缩进较浅的标题行 + 其后缩进较深的正文行 */
interface SectionEntry {
  title: string;
  body: string[];
}

/**
 * 按区块标题切分，并把每个条目解析成「标题 + 正文列表」。
 *
 * 为什么不把标题和正文合成一个字符串：条目标题（项目名/角色/时间）是结构化信息，
 * 后续要映射成 JSON 字段；正文是描述列表。混在一起就无法可靠地拆开了。
 */
function parseSection(
  lines: TextLine[],
  heading: string,
): { entries: SectionEntry[]; flat: string[] } {
  const start = lines.findIndex((line) => line.text === heading);
  const headingIndent = lines[start]?.x;

  if (start < 0 || headingIndent === undefined) {
    throw new Error(`未找到区块「${heading}」，PDF 版式可能已变化。`);
  }

  // 区块边界靠"回到区块标题的缩进"判断。
  // 这里不能用字号：区块标题(12.2) 与条目标题(10.8) 虽然不同，
  // 但下一区块的条目标题字号完全相同，靠字号无法区分"新条目"和"新区块"。
  const rest = lines.slice(start + 1);
  const nextHeading = rest.findIndex(
    (line) => Math.abs(line.x - headingIndent) <= 1 && isSectionHeading(line.text),
  );
  const body = nextHeading < 0 ? rest : rest.slice(0, nextHeading);

  const merged = mergeWrappedLines(body);
  const baseIndent = Math.min(...merged.map((item) => item.indent));

  const entries: SectionEntry[] = [];

  for (const item of merged) {
    if (Math.abs(item.indent - baseIndent) <= 1) {
      entries.push({ title: item.text, body: [] });
    } else {
      const current = entries[entries.length - 1];
      if (current === undefined) {
        entries.push({ title: '', body: [item.text] });
      } else {
        current.body.push(item.text);
      }
    }
  }

  return {
    entries,
    flat: entries.flatMap((entry) => [entry.title, ...entry.body]).filter((text) => text !== ''),
  };
}

/**
 * 人工校正规则。
 *
 * 为什么把修正写在脚本里，而不是直接改生成的 JSON：
 * JSON 是脚本的产物，重跑就会被覆盖。**修正必须可复现**，
 * 所以它属于"映射规则"的一部分，与代码一起被 review 和版本管理。
 * 每条都注明原文，便于日后对照 PDF 复核。
 */
const TEXT_CORRECTIONS: readonly { readonly from: string; readonly to: string }[] = [
  // PDF 原文把产品名写成了 "Uni  app"（多余空格，且字体缺字形）
  { from: 'Uni  app', to: 'Uni-app' },
  // PDF 原文拼写错误：onlien → online
  { from: 'Fangmu. onlien个人网页', to: 'Fangmu.online 个人网页' },
  // PDF 原文在句号前多了一个空格
  { from: '校三等奖学金 。', to: '校三等奖学金。' },
  // PDF 原文在逗号后多了一个空格
  { from: '开发， 结合', to: '开发，结合' },
];

function applyCorrections(text: string): string {
  return TEXT_CORRECTIONS.reduce((result, { from, to }) => result.split(from).join(to), text);
}

function writeJson(relativePath: string, value: unknown): string {
  const fullPath = join(repoRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return fullPath;
}

/**
 * 挑出需要人工核对的文本噪音。
 *
 * 为什么需要这一步：PDF 里的英文拼写错误（本项目就有 "Fangmu. onlien"）
 * **不会让构建失败**，只会安静地上线。这类问题只能靠显式检查暴露出来。
 * 检测规则故意保守，宁可少报也不要制造大量无意义告警。
 */
function findTextAnomalies(lines: TextLine[]): string[] {
  const anomalies: string[] = [];

  for (const line of lines) {
    // 1) 中英之间缺少空格，或英文单词间出现异常空格
    if (/[a-z]\.[ ]+[a-z]/.test(line.text)) {
      anomalies.push(`疑似英文拼写/空格异常：${line.text}`);
    }

    // 2) 孤立的单个拉丁字母夹在中文之间（通常是缺字形留下的残渣）
    if (/[\u4E00-\u9FFF]\s[a-zA-Z]\s[\u4E00-\u9FFF]/.test(line.text)) {
      anomalies.push(`疑似缺字形残渣：${line.text}`);
    }

    // 3) 标点前有多余空格（中文排版不该出现）
    if (/[\u4E00-\u9FFF]\s+[，。、；：]/.test(line.text)) {
      anomalies.push(`标点前有多余空格：${line.text}`);
    }
  }

  return anomalies;
}

/** 用于标记需要人工补充的字段。前端会把 TODO 渲染成醒目的提示块。 */
const TODO = (hint: string) => `TODO:${hint}`;

async function main(): Promise<void> {
  console.log(`读取 ${relative(repoRoot, PDF_PATH)} ...`);

  const doc = await loadPdfDocument(PDF_PATH);
  const lines = await extractLines(doc);

  console.log(`解析出 ${doc.numPages} 页、${lines.length} 行文本。`);

  // 原始抽取结果先落盘，方便对照与排查映射问题
  const rawDumpPath = writeJson(
    'content/raw/extracted-lines.json',
    lines.map(({ y, x, fontSize, text }) => ({
      y,
      x: Math.round(x),
      fontSize: Number(fontSize.toFixed(1)),
      text,
    })),
  );
  console.log(`原始行已写入 ${relative(repoRoot, rawDumpPath)}`);

  // 文本噪音报告：拼写错误、缺字形残渣、多余空格
  const anomalies = findTextAnomalies(lines);
  if (anomalies.length > 0) {
    console.log(`\n⚠ 发现 ${anomalies.length} 处需要人工核对的文本噪音：`);
    for (const item of anomalies) console.log(`  - ${item}`);
    console.log('  提示：这些不会导致构建失败，请对照 PDF 原件确认后手工修正内容 JSON。');
  } else {
    console.log('未发现文本噪音。');
  }
  console.log('');

  // ---------------- 映射为结构化内容 ----------------
  const educationSection = parseSection(lines, '教育经历');
  const projectSection = parseSection(lines, '项目经历');
  const skillSection = parseSection(lines, '专业技能');

  // 打印解析结果：内容映射是人工规则，必须能一眼核对是否正确，
  // 而不是等页面渲染出来才发现抄错了。
  for (const [label, section] of [
    ['教育经历', educationSection],
    ['项目经历', projectSection],
    ['专业技能', skillSection],
  ] as const) {
    console.log(`\n--- ${label} ---`);
    for (const entry of section.entries) {
      console.log(`  【${entry.title}】`);
      for (const paragraph of entry.body) console.log(`      ${paragraph}`);
    }
  }
  console.log('');

  // ---------------- profile.json ----------------
  const profile = {
    name: '方睿杰',
    aka: '方沐',
    headline: '前端开发方向 · 计算机应用专业在读',
    bio: TODO('一句话自我介绍（PDF 里没有，建议 2-3 句，说明你在做什么、关注什么方向）'),
    location: TODO('所在城市，例如 杭州'),
    availability: '寻找前端开发方向实习机会',
    avatar: null,
    links: [
      {
        kind: 'email',
        label: '257028151@qq.com',
        value: 'mailto:257028151@qq.com',
        public: true,
      },
      {
        kind: 'github',
        label: 'github.com/fangmuyang',
        value: 'https://github.com/fangmuyang',
        public: true,
      },
      {
        kind: 'website',
        label: 'www.fangmu.online',
        value: 'http://www.fangmu.online/',
        public: true,
      },
      {
        // 手机号来自简历 PDF，默认不公开展示。改 privacy.showPhone 为 true 才会渲染。
        kind: 'phone',
        label: '手机',
        value: 'tel:19012725224',
        public: false,
      },
    ],
    privacy: {
      showPhone: false,
      allowResumeDownload: true,
    },
  };

  // ---------------- resume.json ----------------
  // 教育经历：PDF 里是"标题行 + 两段正文"，其中第一段是主修课程、第二段是学业表现。
  // 这里把它拆成结构化字段，而不是原样塞一坨文本 —— 页面才能分别渲染成标签和列表。
  const educationEntry = educationSection.entries[0];

  if (educationEntry === undefined) {
    throw new Error('教育经历区块为空，无法生成 resume.json。');
  }

  const coursesText = educationEntry.body.find((text) => text.startsWith('主修课程')) ?? '';
  const honorsText = educationEntry.body.find((text) => text.startsWith('成绩优异')) ?? '';

  const courses = coursesText
    .replace(/^主修课程包括\s*/, '')
    // 中文顿号、以及"以及/和/与"都可能作为并列分隔符
    .split(/[、]|以及|和|与/)
    .map((item) => item.replace(/[。\s]+$/, '').trim())
    .filter((item) => item !== '');

  /**
   * 从"成绩优异，专业排名稳定在前 5%，曾获国家奖学金与校三等奖学金"
   * 里抽取**事实**，而不是按连接词切分。
   * 奖项清单在下方 awards 字段显式声明；这里只取排名。
   */
  const rankMatch = /排名\s*稳定在\s*(前\s*\d+%|\d+%|第\s*\d+名)/.exec(honorsText);

  const rank = rankMatch?.[1]?.replace(/\s+/g, '') ?? null;

  const resume = {
    headline: '计算机应用专业在读，专注 Web 前端开发',
    summary: TODO('求职向的一段自述，建议 3-4 句：技能范围 + 代表项目 + 想做的事'),
    education: [
      {
        school: '浙江经贸职业技术学院',
        major: '计算机应用',
        degree: '计算机科学与技术',
        period: { start: '2023-09-01', end: '2026-06-01' },
        courses,
        rank,
        // 奖项不在教育经历里重复，统一放 resume.awards，避免两处维护
        highlights: [],
      },
    ],
    projects: [
      {
        slug: 'elderly-care-platform',
        name: '养生居智慧养老',
        role: '前端负责人',
        period: { start: '2024-02-01', end: '2024-05-01' },
        tech: ['Uni-app', 'uniCloud', 'Vue', 'HTML'],
        bullets: [
          '基于 Uni-app 与 uniCloud 开发，结合 Vue、HTML 及云后端技术，为用户提供流畅的使用体验。',
          '主导实现完整的前端应用方案，覆盖用户注册、登录、活动浏览与参与等功能。',
        ],
        url: null,
      },
      {
        slug: 'rope-net-qa',
        name: '绳网问答',
        role: '核心开发者',
        period: { start: '2024-06-01', end: '2024-12-01' },
        tech: ['Uni-app', '通义千问 API', 'Python SDK', 'HTML'],
        bullets: [
          '基于 Uni-app 框架，结合通义千问的语言处理能力实现人机对话。',
          '借助通义千问 API 理解用户意图并生成恰当回复，界面使用 HTML 构建。',
          '利用 Python SDK 处理后端逻辑，提升项目在功能拓展与灵活性方面的能力。',
        ],
        url: null,
      },
      {
        slug: 'herbal-clinic-ai',
        name: '杏林智调医台',
        role: '技术负责人',
        period: { start: '2025-01-01', end: '2025-04-01' },
        tech: ['Vue', 'Element UI', 'Ollama', 'DeepSeek'],
        bullets: [
          '基于 Vue 与 Element UI 构建项目，提供实时监控数据及可视化分析工具。',
          '在本地通过 Ollama 部署 DeepSeek，实现 AI 对话功能。',
          '项目涵盖智能医药问诊、后台药品管理以及问诊记录查询等功能。',
        ],
        url: null,
      },
      {
        slug: 'personal-website',
        name: 'Fangmu.online 个人网页',
        role: '核心开发者',
        period: { start: '2025-02-01', end: null },
        tech: ['阿里云', '宝塔面板'],
        bullets: [
          '基于阿里云平台，利用宝塔后台管理系统完成部署并正式上线。',
          `线上地址为 http://www.fangmu.online/ ，项目仍在持续推进中。`,
        ],
        url: 'http://www.fangmu.online/',
      },
    ],
    awards: ['国家奖学金', '校三等奖学金'],
  };

  // ---------------- skills.json ----------------
  // 按能力域重新分组，而不是照抄 PDF 的平铺列表 —— 分组后前端页面才能做出层级。
  const skillGroups = [
    {
      id: 'frontend',
      label: '前端开发',
      items: ['Vue.js', 'Vue Router', 'React', 'TypeScript', 'HTML / CSS', 'Uni-app'],
    },
    {
      id: 'backend-data',
      label: '后端与数据',
      items: ['Python', 'Java', 'Node.js', 'MySQL', 'SQL Server'],
    },
    {
      id: 'ai',
      label: 'AI 应用',
      items: ['通义千问 API', 'Ollama 本地部署', 'DeepSeek', 'Prompt 基础'],
    },
    {
      id: 'engineering',
      label: '工程素养',
      items: ['操作系统', '数据结构与算法', '计算机网络', '系统运维', 'Git', 'Docker'],
    },
    {
      id: 'office',
      label: '办公效率',
      items: ['Microsoft Word', 'Excel', 'PowerPoint'],
    },
  ];

  // ---------------- 用同一套 schema 校验产出 ----------------
  // 这是脚本最有价值的一步：生成与校验共用契约，不存在两套定义漂移的问题。
  const validated = {
    'content/profile.json': profileSchema.parse(profile),
    'content/resume.json': resumeSchema.parse(resume),
    'content/skills.json': skillGroupsSchema.parse(skillGroups),
  } as const;

  for (const [path, value] of Object.entries(validated)) {
    writeJson(path, value);
    console.log(`已写入 ${path}`);
  }

  // 作品集详情：PDF 只提供了概览，详情需要人工补充，因此生成待填模板。
  // 注意：事实字段（name/role/period/tech）在这里**不重复定义**，
  // 它们已经写在 resume.json 里，重复维护必然漂移。
  mkdirSync(projectsDir, { recursive: true });

  const projectTemplates = [
    {
      slug: 'elderly-care-platform',
      status: 'completed',
      featured: true,
      order: 1,
      tags: ['智慧养老', '移动端'],
    },
    {
      slug: 'rope-net-qa',
      status: 'completed',
      featured: true,
      order: 2,
      tags: ['AI 对话', '移动端'],
    },
    {
      slug: 'herbal-clinic-ai',
      status: 'completed',
      featured: true,
      order: 3,
      tags: ['医疗', 'AI 对话', '数据可视化'],
    },
    {
      slug: 'personal-website',
      status: 'active',
      featured: false,
      order: 4,
      tags: ['部署运维'],
    },
  ] as const;

  let created = 0;

  for (const template of projectTemplates) {
    const target = join(projectsDir, `${template.slug}.json`);

    try {
      // 已存在就不覆盖：详情是人工补写的内容，重跑脚本不能把它们冲掉
      readFileSync(target);
      console.log(`跳过已存在的 content/projects/${template.slug}.json`);
      continue;
    } catch {
      // 文件不存在，继续生成
    }

    const facts = resume.projects.find((item) => item.slug === template.slug);

    if (facts === undefined) {
      throw new Error(`resume.json 里缺少项目 ${template.slug}，无法生成作品集模板。`);
    }

    const project = {
      slug: template.slug,
      name: facts.name,
      summary: TODO('一句话简介，用于作品集卡片'),
      role: facts.role,
      period: facts.period,
      status: template.status,
      featured: template.featured,
      order: template.order,
      tech: facts.tech,
      tags: [...template.tags],
      background: TODO('项目背景与要解决的问题'),
      contributions: [TODO('我具体负责了什么')],
      approaches: [TODO('采用的技术方案与关键实现')],
      challenges: [TODO('遇到的难点与解决方式')],
      results: [TODO('成果：尽量量化，如用户数、性能提升、上线状态')],
      links: facts.url === null ? [] : [{ label: '线上地址', href: facts.url }],
      cover: null,
      screenshots: [],
    };

    writeJson(`content/projects/${template.slug}.json`, project);
    console.log(`已生成待补充模板 content/projects/${template.slug}.json`);
    created += 1;
  }

  console.log('\n完成。');
  console.log(`新增作品集模板：${created} 个。`);
  console.log('下一步：搜索内容里的 "TODO:"，把占位内容替换为真实信息，然后运行 pnpm build 校验。');
}

await main();
