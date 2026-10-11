import { expect, test } from '@playwright/test';

/**
 * 交互功能 E2E：搜索、筛选、表单、PDF 预览。
 *
 * 这些交互在单测里覆盖不到的部分：
 * - **搜索面板**：`<dialog>.showModal()` 的焦点陷阱、Escape 关闭、
 *   键盘上下选择 —— 都需要真实的焦点模型；
 * - **筛选**：URL 查询参数与浏览器历史（后退）的真实行为；
 * - **表单**：原生表单校验、焦点跳转、错误信息关联；
 * - **PDF 预览**：pdfjs 在真实浏览器里渲染 canvas（含 worker 加载）。
 */

test.describe('站内搜索', () => {
  test('快捷键唤起面板，Escape 关闭', async ({ page }) => {
    await page.goto('');

    // Control+K（Linux/Windows 约定）；macOS 上是 Meta+K
    await page.keyboard.press('Control+k');

    const dialog = page.getByRole('dialog', { name: '站内搜索' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('搜索面板打开后输入框自动获得焦点', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    // 焦点应该在输入框里，用户可以直接打字 —— 这是模态框的基本要求
    await expect(page.getByRole('combobox')).toBeFocused();
  });

  test('输入关键词能搜到结果', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('React');

    // 结果列表应出现条目（本项目的内容里有多个含 React 的条目）
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThan(0);
  });

  test('搜索无结果时给出明确提示', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('zzzzzzzz-不存在的关键词');

    await expect(page.getByText(/没有找到与/)).toBeVisible();
  });

  test('用键盘选择结果并回车跳转', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('React');
    await expect(page.getByRole('option').first()).toBeVisible();

    await page.keyboard.press('Enter');

    // 跳转后对话框应关闭，且 URL 发生变化
    await expect(page.getByRole('dialog', { name: '站内搜索' })).toBeHidden();
    expect(page.url()).not.toMatch(/\/resume\/$/);
  });

  test('点击结果能跳转', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('养生居');
    const first = page.getByRole('option').first();
    await expect(first).toBeVisible();
    await first.click();

    await expect(page.getByRole('dialog', { name: '站内搜索' })).toBeHidden();
  });

  test('关闭后重新打开是干净状态', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();
    await page.getByRole('combobox').fill('React');
    await page.keyboard.press('Escape');

    // 重新打开：查询词应被清空（阶段 7 里刻意在关闭时重置）
    await page.getByRole('button', { name: '站内搜索' }).click();
    await expect(page.getByRole('combobox')).toHaveValue('');
  });
});

test.describe('作品集筛选', () => {
  test('点击标签筛选并把状态写入 URL', async ({ page }) => {
    await page.goto('projects');

    await page.getByRole('button', { name: 'Vue', exact: true }).click();

    // 筛选状态由 URL 承载 —— 这是阶段 4 的核心设计
    await expect.poll(() => page.url()).toContain('tags=Vue');
  });

  test('直接打开带参数的链接会应用筛选', async ({ page }) => {
    // 验证"可分享链接"这个需求真的成立
    await page.goto('projects?tags=Vue');

    await expect(page.getByRole('button', { name: 'Vue', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('清除筛选能恢复全部结果', async ({ page }) => {
    await page.goto('projects?tags=Vue');

    await page.getByRole('button', { name: /清除筛选/ }).click();

    await expect.poll(() => page.url()).not.toContain('tags=');
  });

  test('筛选切换用 replace，不堆积历史记录', async ({ page }) => {
    await page.goto('projects');
    const before = await page.evaluate(() => history.length);

    await page.getByRole('button', { name: 'Vue', exact: true }).click();
    await page.getByRole('button', { name: 'React', exact: true }).click();

    const after = await page.evaluate(() => history.length);

    // 用 push 的话每点一次标签就多一条历史，用户要按很多次后退才能离开
    expect(after, '切换筛选不应产生新的历史记录').toBe(before);
  });

  test('无匹配结果时给出口', async ({ page }) => {
    await page.goto('projects?tags=不存在的标签');

    await expect(page.getByText(/没有同时满足这些标签的项目/)).toBeVisible();
    await expect(page.getByRole('button', { name: '清除筛选' })).toBeVisible();
  });
});

test.describe('联系表单', () => {
  test('空表单提交时逐个字段报错', async ({ page }) => {
    await page.goto('contact');

    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText('请填写你的称呼')).toBeVisible();
    await expect(page.getByText('请填写邮箱，方便我回复你')).toBeVisible();
    await expect(page.getByText(/内容太短了/)).toBeVisible();
  });

  test('邮箱格式错误时给出针对性提示', async ({ page }) => {
    await page.goto('contact');

    await page.getByLabel('你的称呼').fill('测试');
    await page.getByLabel('邮箱').fill('not-an-email');
    await page.getByLabel('想说的话').fill('这是一条足够长的测试留言内容。');
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText(/邮箱格式看起来不对/)).toBeVisible();
  });

  test('出错字段带 aria-invalid 并与错误信息关联', async ({ page }) => {
    await page.goto('contact');
    await page.getByRole('button', { name: '发送消息' }).click();

    const emailInput = page.getByLabel('邮箱');
    // 屏幕阅读器需要这两项才能把错误读出来
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    const describedBy = await emailInput.getAttribute('aria-describedby');
    expect(describedBy, 'aria-describedby 应指向错误文本').not.toBeNull();

    // 确认它确实指向存在的元素
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
  });

  test('合法输入能提交成功', async ({ page }) => {
    await page.goto('contact');

    await page.getByLabel('你的称呼').fill('方测试');
    await page.getByLabel('邮箱').fill('test@example.com');
    await page.getByLabel('想说的话').fill('这是一条足够长的测试留言，用于验证提交路径。');
    await page.getByRole('button', { name: '发送消息' }).click();

    await expect(page.getByText('已收到你的消息')).toBeVisible();
  });
});

test.describe('简历页 PDF 预览', () => {
  test('默认不加载 PDF 引擎（懒加载）', async ({ page }) => {
    const pdfChunkRequests: string[] = [];
    page.on('request', (request) => {
      if (/\/pdf-.*\.js$/.test(request.url())) pdfChunkRequests.push(request.url());
    });

    await page.goto('resume');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('简历');

    // 没点"预览"之前不应下载 PDF 引擎（400+ KB）
    expect(pdfChunkRequests, '未展开预览时不应加载 PDF 引擎').toEqual([]);
  });

  test('展开预览后在 canvas 上渲染第一页', async ({ page }) => {
    await page.goto('resume');

    await page.getByRole('button', { name: '在页面内预览' }).click();

    // canvas 带 aria-label，用 role=img 能定位到
    const canvas = page.getByRole('img', { name: '简历 PDF 第一页预览' });
    await expect(canvas).toBeVisible({ timeout: 30_000 });

    // 确认真的画上了内容：canvas 的尺寸应大于 0（pdfjs 已渲染）
    const size = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      return { width: canvasElement.width, height: canvasElement.height };
    });

    expect(size.width, 'canvas 宽度应大于 0').toBeGreaterThan(0);
    expect(size.height, 'canvas 高度应大于 0').toBeGreaterThan(0);
  });

  test('PDF 下载链接指向正确地址', async ({ page }) => {
    await page.goto('resume');

    const downloadLink = page.getByRole('link', { name: /下载简历 PDF/ });
    await expect(downloadLink).toBeVisible();

    // 下载地址必须带 base 前缀，否则子路径部署下必然 404
    const href = await downloadLink.getAttribute('href');
    expect(href).toBe('/resume/resume.pdf');
    await expect(downloadLink).toHaveAttribute('download');
  });
});

test.describe('隐私', () => {
  test('网页正文不显示手机号', async ({ page }) => {
    for (const path of ['', 'about', 'resume', 'contact']) {
      await page.goto(path);
      const text = await page.evaluate(() => document.body.innerText);

      // 断言的是"页面上看不到"，而不是"数据不在 bundle 里"——
      // 后者由 pnpm verify:privacy 在构建产物层面验证
      expect(text, `${path} 页面不应出现手机号`).not.toMatch(/19012725224/);
    }
  });
});
