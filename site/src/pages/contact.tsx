import { Mail } from 'lucide-react';

import { Reveal } from '@/components/motion/reveal';
import { TextWithPlaceholder } from '@/components/text-with-placeholder';
import { Container } from '@/components/ui/container';
import { ContactForm } from '@/features/contact/contact-form';
import { profile, pageMeta } from '@/lib/content';
import { Seo } from '@/lib/seo/seo';

/**
 * 联系方式页。
 *
 * 联系方式列表直接读 `profile.links` —— 非公开条目在构建期就被剥离了
 * （见 scripts/build-public-content.ts），所以这里不需要再判断 privacy 开关。
 */
export default function ContactPage() {
  return (
    <Container className="py-16">
      <Seo
        title={pageMeta.contact.title}
        description={pageMeta.contact.description}
        path="/contact"
      />

      <Reveal>
        <p className="text-brand-600 dark:text-brand-500 font-mono text-sm">contact</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">联系方式</h1>
        <p className="mt-4 max-w-prose leading-relaxed text-slate-600 dark:text-slate-400">
          {pageMeta.contact.description}
        </p>
      </Reveal>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        {/* ---------- 直接联系方式 ---------- */}
        <Reveal>
          <section className="grid gap-4">
            <h2 className="text-xl font-semibold tracking-tight">直接联系</h2>

            <ul className="grid gap-3">
              {profile.links.map((link) => (
                <li key={link.kind}>
                  <a
                    href={link.value}
                    className="group hover:text-brand-600 dark:hover:text-brand-500 flex items-center gap-3 text-sm text-slate-600 transition-colors dark:text-slate-400"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800">
                      <Mail aria-hidden className="size-4" />
                    </span>
                    <span className="break-all">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>

            {profile.availability !== null ? (
              <TextWithPlaceholder
                text={profile.availability}
                className="text-sm text-slate-500 dark:text-slate-400"
              />
            ) : null}
          </section>
        </Reveal>

        {/* ---------- 表单 ---------- */}
        <Reveal>
          <section className="grid gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">给我留言</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                表单会在本地校验后模拟提交，不会真正发送邮件。
              </p>
            </div>

            <ContactForm />
          </section>
        </Reveal>
      </div>
    </Container>
  );
}
