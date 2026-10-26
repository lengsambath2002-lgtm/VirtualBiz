import { useTranslations } from 'next-intl';

import { Logo } from '@/components/ui';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import { searchHref } from '../util/searchHref';
import s from './landing.module.css';

export function LandingFooter({ khrPerUsd }: { khrPerUsd: number }) {
  const t = useTranslations('marketing');
  const tc = useTranslations('common');
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.ft}>
          <div>
            <a className={s.ftLogo} href="#top" aria-label={t('nav.home')}>
              <Logo
                size="marketing"
                className="gap-[9px] font-extrabold tracking-[-.02em] text-current"
              />
            </a>
            <p className={cn(s.muted, s.ftTagline)}>{t('footer.tagline')}</p>
          </div>
          <div>
            <h4>{t('footer.customers')}</h4>
            <Link href={searchHref()}>{t('nav.shopAndBook')}</Link>
            <Link href={searchHref()}>{t('footer.deals')}</Link>
            <a href="#faq">{t('footer.helpCentre')}</a>
          </div>
          <div>
            <h4>{t('footer.business')}</h4>
            <Link href="/create-business">{t('nav.openShop')}</Link>
            <Link href="/seller">{t('footer.sellerPos')}</Link>
            <Link href="/provider">{t('footer.bookings')}</Link>
            <a href="#pricing">{t('nav.pricing')}</a>
          </div>
          <div>
            <h4>{t('footer.company')}</h4>
            <a href="#top">{t('footer.about')}</a>
            <a href="#faq">{t('footer.contact')}</a>
            <Link href="/terms">{t('footer.terms')}</Link>
            <Link href="/privacy">{t('footer.privacy')}</Link>
          </div>
        </div>
        <div className={s.ftB}>
          <span>{t('footer.copyright')}</span>
          <span>{tc('rateNote', { rate: khrPerUsd.toLocaleString('en-US') })}</span>
        </div>
      </div>
    </footer>
  );
}
