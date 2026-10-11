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

    /**
     * 必须先等页面渲染完成，再按快捷键。
     *
     * 搜索面板的快捷键监听挂在 `SearchLauncher` 上，而它随根布局一起挂载。
     * 如果 `goto` 之后立刻按键，React 可能还没跑完首次渲染 ——
     * 事件被派发出去了但没人监听。
     *
     * 症状是"这个用例单独跑能过、整套跑就挂"，很容易误判成功能坏了。
     * 所以这里显式等一个稳定的就绪信号。
     */
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: '站内搜索' }).click();

    /**
     * 用一个**只匹配到一个结果**的关键词。
     *
     * 这样"按一次下箭头选中第一项，回车跳转"的断言就是确定的：
     * 无论结果排序如何，选中项都是那唯一的一条。
     * 用宽泛关键词（如 React）时，选中的是哪一条取决于排序，
     * 断言"URL 变了"就会变得含糊 —— 而这正是第一版失败的原因。
     */
    await page.getByRole('combobox').fill('养生居');
    await expect(page.getByRole('option').first()).toBeVisible();

    // 未选中任何项时回车不应跳转（这是刻意设计，见 search-dialog 的说明）
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog', { name: '站内搜索' })).toBeHidden();
    await expect.poll(() => page.url()).toContain('/projects/');
  });

  test('未按方向键时回车不跳转', async ({ page }) => {
    // 输入后清空选中态：用户还在找目标，此时回车不该替他做决定
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('养生居');
    await expect(page.getByRole('option').first()).toBeVisible();

    await page.keyboard.press('Enter');

    // 面板仍开着，URL 没变
    await expect(page.getByRole('dialog', { name: '站内搜索' })).toBeVisible();
    expect(page.url()).toMatch(/\/resume\/$/);
  });

  test('方向键第一次按下只选中第一项', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: '站内搜索' }).click();

    await page.getByRole('combobox').fill('养生居');
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible();

    await page.keyboard.press('ArrowDown');

    /**
     * 断言第一项被选中，而不是第二项。
     *
     * 第一版实现是 `(index + 1) % length`，初始 index 为 0，
     * 于是按一次下箭头直接跳到第二项 —— 用户按一下却选中了第二个结果。
     * 这里用 `aria-selected` 把它固定下来。
     */
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');
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
  /**
   * 筛选按钮必须限定在筛选分组内。
   *
   * 项目卡片本身也会渲染技术标签，所以页面上 `Vue` 这个名字会出现多次
   * （诊断时数到 40 个按钮，其中大量来自卡片）。
   * `TagFilter` 因此加了 `role="group"` + `aria-label="标签筛选"`，
   * 这里用它精确定位 —— 之前用 getByRole('button', { name: 'Vue' })
   * 会因为 strict 模式命中多个元素而失败。
   */
  const filterGroup = (page: import('@playwright/test').Page) =>
    page.getByRole('group', { name: '标签筛选' });

  test('点击标签筛选并把状态写入 URL', async ({ page }) => {
    await page.goto('projects');

    await filterGroup(page).getByRole('button', { name: 'Vue', exact: true }).click();

    // 筛选状态由 URL 承载 —— 这是阶段 4 的核心设计
    await expect.poll(() => page.url()).toContain('tags=Vue');
  });

  test('直接打开带参数的链接会应用筛选', async ({ page }) => {
    // 验证"可分享链接"这个需求真的成立
    await page.goto('projects?tags=Vue');

    await expect(
      filterGroup(page).getByRole('button', { name: 'Vue', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('清除筛选能恢复全部结果', async ({ page }) => {
    await page.goto('projects?tags=Vue');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();

    /**
     * 「清除筛选」在页面上有两处：筛选条里、以及无结果时的空状态里。
     * 筛选条里那个位于 `role="group" aria-label="标签筛选"` **之外**
     * （它在同一个 grid 的第二个子 div 里），所以不能靠分组定位。
     *
     * 用 `getByText` 会匹配到包含这段文字的元素 —— 这里就是按钮本身。
     */
    await page.getByText('清除筛选', { exact: true }).click();

    await expect.poll(() => page.url()).not.toContain('tags=');
    await expect(
      filterGroup(page).getByRole('button', { name: 'Vue', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('筛选切换用 replace，不堆积历史记录', async ({ page }) => {
    await page.goto('projects');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const before = await page.evaluate(() => history.length);

    // 用实际存在的标签：React 只是技能列表里的词，并不是项目标签
    await filterGroup(page).getByRole('button', { name: 'Vue', exact: true }).click();
    await filterGroup(page).getByRole('button', { name: 'HTML', exact: true }).click();

    const after = await page.evaluate(() => history.length);

    // 用 push 的话每点一次标签就多一条历史，用户要按很多次后退才能离开
    expect(after, '切换筛选不应产生新的历史记录').toBe(before);
  });

  test('无匹配结果时给出口', async ({ page }) => {
    /**
     * 这个用例改了五次，过程本身比结论更有教育意义 —— 前四次失败**全都不是代码问题**。
     *
     * 1. `Vue` + `HTML`：同时出现在 elderly-care-platform 上；
     * 2. `Vue` + `医疗`：同时出现在 herbal-clinic-ai 上；
     * 3. `Uni-app` + `Vue`：**又同时出现在 elderly-care-platform 上**。
     *    这次我怀疑 AND 筛选有 bug，查了 store、纯函数、构建产物，
     *    最后把标签的字符码打出来，才确认代码正确、是我的数据假设错了；
     * 4. 改成"循环尝试标签组合"的自适应写法 —— 逻辑没错，但引入了新问题：
     *    断言用了 `getByText('清除筛选', { exact: true })`，
     *    它同时命中按钮**和按钮祖先 div 的纯文本**，严格模式直接报错。
     *
     * 教训有两条：
     * - 用测试数据前先确认它真的满足前提（别凭直觉挑标签）；
     * - 定位元素用**角色 + 名称**，不要用纯文本 —— 祖先元素会带着同样的文字。
     *
     * 最终用 `Vue` + `Python SDK`：实测产生空结果（0 个项目），
     * 且 `match=all` 的参数形式已验证能被解析。
     */
    await page.goto('projects?tags=Vue,Python%20SDK&match=all');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();

    await expect(page.getByText(/没有同时满足这些标签的项目/)).toBeVisible();

    /**
     * 用 `.first()`，因为页面上有**两个**「清除筛选」按钮：
     * 筛选条里一个，空状态里一个。两者都有意义（一个随时可清，一个在无结果时救急），
     * 所以不该删掉其中一个来迁就测试；测试应该接受这个事实。
     *
     * 不指定会触发严格模式错误："resolved to 2 elements"。
     */
    await expect(page.getByRole('button', { name: '清除筛选' }).first()).toBeVisible();
  });

  test('可以在任一标签与全部标签之间切换', async ({ page }) => {
    await page.goto('projects?tags=Vue,HTML');

    const group = page.getByRole('radiogroup', { name: '标签匹配方式' });
    await expect(group).toBeVisible();

    // 默认是"任一标签"
    await expect(group.getByRole('radio', { name: '任一标签' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const unionCount = await page.getByRole('link', { name: /查看详情/ }).count();

    await group.getByRole('radio', { name: '全部标签' }).click();

    await expect.poll(() => page.url()).toContain('match=all');
    await expect(group.getByRole('radio', { name: '全部标签' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // AND 的结果不会多于 OR
    const intersectionCount = await page.getByRole('link', { name: /查看详情/ }).count();
    expect(intersectionCount).toBeLessThanOrEqual(unionCount);
  });

  test('只选一个标签时不显示匹配方式', async ({ page }) => {
    /**
     * 单个标签时"任一"与"全部"结果完全相同，显示出来只会造成困惑。
     * 这条用例把"何时隐藏"这个判断固定下来。
     */
    await page.goto('projects?tags=Vue');

    await expect(page.getByRole('radiogroup', { name: '标签匹配方式' })).toHaveCount(0);
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
