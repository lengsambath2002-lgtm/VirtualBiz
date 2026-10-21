'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import {
  cx,
  Ic,
  initials,
  s,
  useDb,
  useFmt,
  useGo,
  useSellerStore,
  useUi,
  type IcName,
  type SellerNotification,
} from '@/features/seller-shared';
import { WorkspaceSwitcher } from '@/features/account-switcher';
import { useStatusNotifText } from '@/features/business-status';
import { useReasonText } from '@/features/seller-orders/hooks/useReasonText';
import { formatUsd } from '@/lib/money';
import { photoBg } from '@/lib/utils/photo';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const NEW_MENU: { key: 'product' | 'receive' | 'promo' | 'manual'; icon: IcName }[] = [
  { key: 'product', icon: 'box' },
  { key: 'receive', icon: 'stock' },
  { key: 'promo', icon: 'tag' },
  { key: 'manual', icon: 'orders' },
];

/** Shop inbox entries (`kind` + `params` from the API) in the UI language. */
export function useNotifText() {
  const t = useTranslations('seller.top.notif');
  const why = useReasonText();
  const status = useStatusNotifText();
  return (n: SellerNotification) => {
    const p = n.params;
    switch (n.kind) {
      case 'NEW_ORDER':
        return t('order', {
          no: p.number ?? '',
          name: p.name ?? '',
          amount: formatUsd(Number(p.amount ?? 0)),
        });
      case 'ORDER_CANCELLED':
        return t('cancelled', { no: p.number ?? '', reason: why(p.reason ?? '') });
      case 'LOW_STOCK':
        return t('low', { item: p.item ?? '', n: Number(p.n ?? 0) });
      case 'NEW_REVIEW':
        return t('review', { name: p.name ?? '', n: Number(p.stars ?? 0) });
      default:
        return status(n.kind, p) ?? n.kind;
    }
  };
}

export function TopBar() {
  const t = useTranslations('seller.top');
  const db = useDb();
  const f = useFmt();
  const go = useGo();
  const menu = useUi((u) => u.menu);
  const setMenu = useUi((u) => u.setMenu);
  const open = useUi((u) => u.open);
  const notifText = useNotifText();
  const unread = db.notifs.filter((n) => n.unread).length;
  const shop = db.shop;

  // Click outside a menu closes it (prototype document click handler).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-menu]')) return;
      setMenu(null);
    };
    document.addEventListener('click', onDown);
    return () => document.removeEventListener('click', onDown);
  }, [menu, setMenu]);

  const runNew = (k: (typeof NEW_MENU)[number]['key']) => {
    setMenu(null);
    if (k === 'product') open({ kind: 'productAdd' });
    else if (k === 'receive') open({ kind: 'receive' });
    else if (k === 'promo') open({ kind: 'promo' });
    else open({ kind: 'manual' });
  };

  return (
    <header className={s.top}>
      <div className={s.biz}>
        <span className={s.lg} style={photoBg(shop.logoUrl)}>
          {shop.logoUrl ? null : initials(shop.name.replace(/\bStore\b/i, ''))}
        </span>
        <div>
          <strong>{shop.name}</strong>
          <span className={s.bizSub}>
            <i className={cx(s.dot, !shop.online && s.dotOff)} />
            {shop.online ? t('open') : t('paused')}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={s.cmdk}
        aria-label={t('searchLabel')}
        onClick={() => open({ kind: 'palette' })}
      >
        <Ic name="search" size={18} />
        <span className={s.cmdkLabel}>{t('search')}</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button
        type="button"
        className={cx(s.btn, s.btnGhost)}
        aria-label={t('scanLabel')}
        onClick={() => open({ kind: 'scan' })}
      >
        <Ic name="scan" size={18} />
        <span className={s.hideS}>{t('scan')}</span>
      </button>
      <div className={s.rel} data-menu>
        <button
          type="button"
          className={cx(s.btn, s.btnPrimary)}
          aria-expanded={menu === 'new'}
          onClick={() => setMenu(menu === 'new' ? null : 'new')}
        >
          <Ic name="plus" size={18} />
          <span className={s.hideS}>{t('new')}</span>
        </button>
        {menu === 'new' && (
          <div className={s.menu} style={{ right: 0 }}>
            {NEW_MENU.map((m) => (
              <button key={m.key} type="button" onClick={() => runNew(m.key)}>
                <Ic name={m.icon} size={18} />
                {t(`newMenu.${m.key}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <LanguageSwitcher compact />
      <div className={s.rel} data-menu>
        <button
          type="button"
          className={s.ibtn}
          aria-label={t('notifsLabel', { n: unread })}
          onClick={() => setMenu(menu === 'notifs' ? null : 'notifs')}
        >
          <Ic name="bell" />
          {unread > 0 && <span className={s.badge}>{unread}</span>}
        </button>
        {menu === 'notifs' && (
          <div className={s.pop}>
            <div className={s.popH}>
              <strong>{t('notifs')}</strong>
              <button
                type="button"
                className={cx(s.link, s.quiet, s.small)}
                onClick={() => useSellerStore.getState().readAllNotifs()}
              >
                {t('readAll')}
              </button>
            </div>
            <div className={s.popB}>
              {!db.notifs.length && (
                <p className={cx(s.small, s.muted)} style={{ padding: '16px', margin: 0 }}>
                  {t('noNotifs')}
                </p>
              )}
              {db.notifs.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={cx(s.mi, n.unread && s.unread)}
                  onClick={() => {
                    useSellerStore.getState().readNotif(n.id);
                    setMenu(null);
                    void go(n.route.replace(/\?order=.*$/, ''));
                  }}
                >
                  <Ic name="bell" size={16} />
                  <span>
                    {notifText(n)}
                    <span className={cx(s.tiny, s.muted, s.block)}>{f.ago(n.at)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={cx(s.link, s.quiet, s.small)}
              style={{ display: 'block', padding: '10px 16px', textAlign: 'left' }}
              onClick={() => {
                setMenu(null);
                void go('/seller/notifications');
              }}
            >
              {t('seeAll')}
            </button>
          </div>
        )}
      </div>
      <WorkspaceSwitcher
        businessId={shop.id}
        className={s.me}
        label={t('account', { name: shop.ownerName })}
      >
        {initials(shop.ownerName)}
      </WorkspaceSwitcher>
    </header>
  );
}
