/**
 * 联系表单校验测试。
 *
 * ## 为什么这类测试特别值得写
 *
 * 校验规则的边界是**最容易写错、也最难从界面上发现**的地方 ——
 * 用户不会来告诉你"邮箱里的空格没被 trim 掉"。
 * 而这里每条规则的输入都是字符串，测试成本极低。
 *
 * ## 顺带记录一个已验证的细节
 *
 * schema 里的 `.trim()` 会在**校验之前**执行，所以 `'  a@b.com  '` 是合法的。
 * 这一点值得用测试固定下来：如果以后有人把 `.trim()` 挪到链尾或删掉，
 * 测试会立刻失败，而不是等到用户反馈"我的邮箱明明对却提交不了"。
 */
import { describe, expect, it } from 'vitest';

import { contactFormSchema } from '@/features/contact/contact-schema';

/** 一份合法输入，各用例在此基础上改单项 */
function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: '张三',
    email: 'zhangsan@example.com',
    topic: 'job',
    message: '这是一条足够长的留言内容。',
    ...overrides,
  };
}

describe('contactFormSchema', () => {
  it('接受合法输入', () => {
    const result = contactFormSchema.safeParse(validInput());

    expect(result.success).toBe(true);
  });

  it('校验通过后返回 trim 过的值', () => {
    const result = contactFormSchema.safeParse(
      validInput({ name: '  张三  ', email: '  a@b.com  ' }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('张三');
    expect(result.data?.email).toBe('a@b.com');
  });

  it('拒绝空的称呼', () => {
    const result = contactFormSchema.safeParse(validInput({ name: '   ' }));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('称呼');
  });

  it('拒绝过长的称呼', () => {
    const result = contactFormSchema.safeParse(validInput({ name: 'x'.repeat(41) }));

    expect(result.success).toBe(false);
  });

  it('拒绝格式错误的邮箱', () => {
    const result = contactFormSchema.safeParse(validInput({ email: 'not-an-email' }));

    expect(result.success).toBe(false);
    // 提示语是给终端用户看的中文，不是给开发者的技术描述
    expect(result.error?.issues[0]?.message).toContain('邮箱');
  });

  it('拒绝空邮箱', () => {
    expect(contactFormSchema.safeParse(validInput({ email: '' })).success).toBe(false);
  });

  it('拒绝未知的主题', () => {
    expect(contactFormSchema.safeParse(validInput({ topic: 'unknown' })).success).toBe(false);
  });

  it('接受全部四个合法主题', () => {
    for (const topic of ['job', 'project', 'feedback', 'other']) {
      expect(contactFormSchema.safeParse(validInput({ topic })).success).toBe(true);
    }
  });

  it('拒绝过短的留言', () => {
    // 太短的留言通常没有可回复的信息量
    expect(contactFormSchema.safeParse(validInput({ message: '你好' })).success).toBe(false);
  });

  it('拒绝过长的留言', () => {
    expect(contactFormSchema.safeParse(validInput({ message: 'x'.repeat(1001) })).success).toBe(
      false,
    );
  });

  it('蜜罐字段留空时通过', () => {
    expect(contactFormSchema.safeParse(validInput({ website: '' })).success).toBe(true);
  });

  it('蜜罐字段可以完全缺失', () => {
    // website 是 optional。如果它变成必填，所有正常提交都会被拦下 ——
    // 而症状是"表单永远提交不了"，很容易查很久
    const withoutWebsite = validInput();
    delete withoutWebsite['website'];

    expect(contactFormSchema.safeParse(withoutWebsite).success).toBe(true);
  });

  it('蜜罐字段填了内容时拒绝（机器人特征）', () => {
    const result = contactFormSchema.safeParse(validInput({ website: 'http://spam.example' }));

    expect(result.success).toBe(false);
  });

  it('一次返回多个字段的错误', () => {
    // 表单需要一次性标出所有出错字段，而不是只报第一个
    const result = contactFormSchema.safeParse({
      name: '',
      email: 'bad',
      topic: 'job',
      message: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThanOrEqual(3);
  });
});
