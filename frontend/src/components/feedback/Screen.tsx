import type { ReactNode } from 'react';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo } from '@/components/ui/Logo';
import { Link } from '@/lib/i18n/navigation';

import { feedbackStyles as s } from './StatusView';

/** A page of its own (outside any shell): the logo and language on top, the view centred. */
export function FeedbackScreen({ children }: { children: ReactNode }) {
  return (
    <div className={s.screen}>
      <header className={s.screenTop}>
        <Link href="/" aria-label="VirtualBiz">
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className={s.screenMain}>{children}</main>
    </div>
  );
}
