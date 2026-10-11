import { Award, GraduationCap, MapPin } from 'lucide-react';

import { Reveal, RevealItem, RevealList } from '@/components/motion/reveal';
import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { profile, resume, skillGroups } from '@/lib/content';
import { isPlaceholder } from '@/lib/content-placeholder';
import { formatPeriod } from '@/lib/format';

/**
 * 「关于我」页。
 *
 * 验收标准之一是**零硬编码文案** —— 本文件里出现的所有内容性文字
 * （姓名、简介、学校、课程、技能）都来自 content/，组件只负责布局。
 * 页面上仅有的字面量是分区标题与图标说明这类结构性文本。
 */
export default function AboutPage() {
  // 隐私开关：只有 privacy.showPhone 为 true 时才显示手机号
  const visibleLinks = profile.links.filter(
    (link) => link.public && (link.kind !== 'phone' || profile.privacy.showPhone),
  );

  return (
    <Container className="py-16">
      <Reveal>
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">about</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">关于我</h1>
      </Reveal>

      {/* ---------- 个人简介 ---------- */}
      <Reveal className="mt-10">
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-tight">个人简介</h2>

          <TextWithPlaceholder
            text={profile.bio}
            className="max-w-prose leading-relaxed text-slate-600 dark:text-slate-400"
          />

          {profile.location !== null ? (
            isPlaceholder(profile.location) ? (
              <TextWithPlaceholder text={profile.location} className="flex-1" />
            ) : (
              <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <MapPin aria-hidden className="size-4" />
                {profile.location}
              </span>
            )
          ) : null}
        </section>
      </Reveal>

      {/* ---------- 教育经历 ---------- */}
      <section className="mt-16 grid gap-6">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight">教育经历</h2>
        </Reveal>

        <RevealList className="grid gap-6">
          {resume.education.map((item) => (
            <RevealItem key={item.school}>
              <div className="flex gap-4">
                {/* 时间线：左侧一条竖线 + 图标节点 */}
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <GraduationCap aria-hidden className="size-4 text-slate-500" />
                  </span>
                  <span aria-hidden className="mt-2 w-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>

                <div className="grid flex-1 gap-3 pb-2">
                  <div>
                    <h3 className="font-semibold">{item.school}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.degree} · {item.major}
                    </p>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-500">
                      {formatPeriod(item.period)}
                    </p>
                  </div>

                  {item.rank !== null ? (
                    <p className="text-sm">
                      <span className="text-slate-500 dark:text-slate-400">学业表现：</span>
                      {item.rank}
                    </p>
                  ) : null}

                  {item.courses.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-sm text-slate-500 dark:text-slate-400">主修课程</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.courses.map((course) => (
                          <Badge key={course} variant="outline">
                            {course}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealList>
      </section>

      {/* ---------- 获奖 ---------- */}
      {resume.awards.length > 0 ? (
        <Reveal className="mt-16">
          <section className="grid gap-4">
            <h2 className="text-xl font-semibold tracking-tight">获奖情况</h2>
            <ul className="grid gap-2">
              {resume.awards.map((award) => (
                <li key={award} className="flex items-center gap-2 text-sm">
                  <Award aria-hidden className="size-4 text-amber-500" />
                  {award}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ) : null}

      {/* ---------- 技能 ---------- */}
      <section className="mt-16 grid gap-6">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight">专业技能</h2>
        </Reveal>

        <RevealList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skillGroups.map((group) => (
            <RevealItem key={group.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </RevealItem>
          ))}
        </RevealList>
      </section>

      {/* ---------- 联系方式（受隐私开关约束） ---------- */}
      <Reveal className="mt-16">
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold tracking-tight">联系方式</h2>
          <ul className="grid gap-2 text-sm">
            {visibleLinks.map((link) => (
              <li key={link.kind}>
                <a
                  href={link.value}
                  className="text-brand-600 dark:text-brand-500 underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>
    </Container>
  );
}
