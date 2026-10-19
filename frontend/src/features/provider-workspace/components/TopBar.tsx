'use client';

import { useTranslations } from 'next-intl';

import { usePaletteHotkey } from '@/features/command-palette';
import { readAllNotifications, readNotification } from '@/features/provider-shared/api';
import { k } from '@/features/provider-shared/cx';
import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi, type Overlay } from '@/features/provider-shared/store';
import { WorkspaceSwitcher } from '@/features/account-switcher';
import { STATUS_KINDS, useStatusNotifText } from '@/features/business-status';
import type { ProviderData, ProviderNotification } from '@/features/provider-shared/types';
import { initials } from '@/features/provider-shared/util/logic';
import { relKey, todayIso } from '@/features/provider-shared/util/time';
import { photoBg } from '@/lib/utils/photo';

const NEW_MENU: [string, PIconName, Overlay][] = [
  ['appointment', 'cal', { t: 'apptForm', opts: {} }],
  ['walkin', 'walk', { t: 'apptForm', opts: { walkin: true } }],
  ['block', 'ban', { t: 'block' }],
  ['quickSale', 'receipt', { t: 'checkout' }],
  ['client', 'users', { t: 'newClient' }],
];

/** Top bar: business, Ctrl K search, + New menu, notifications, account. */
export function TopBar() {
  const t = useTranslations('provider');
  const d = useData();
  const menu = useUi((s) => s.menu);
  const set = useUi((s) => s.set);
  const open = useUi((s) => s.open);
  const a = useActions();
  usePaletteHotkey(() => open({ t: 'palette' }));
  const unread = d.notifications.filter((n) => n.unread).length;
  const b = d.business;

  return (
    <header className={k('top')}>
      <div className={k('biz')}>
        <span className={k('lg')} style={photoBg(b.logoUrl)}>
          {b.logoUrl ? null : initials(b.name)}
        </span>
        <div>
          <strong>{b.name}</strong>
          <span>
            <i className={k('dot', !b.online && 'off')} />
            {b.online ? t('shell.onlineOn') : t('shell.onlinePaused')}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={k('cmdk')}
        aria-label={t('shell.searchLabel')}
        onClick={() => open({ t: 'palette' })}
      >
        <PIcon name="search" size={18} />
        <span>{t('shell.searchPlaceholder')}</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className={k('rel')} data-menu>
        <button
          type="button"
          className={k('btn btn-primary')}
          aria-expanded={menu === 'new'}
          onClick={() => set({ menu: menu === 'new' ? null : 'new' })}
        >
          <PIcon name="plus" size={18} />
          <span className={k('hide-s')}>{t('shell.newBtn')}</span>
        </button>
        {menu === 'new' && (
          <div className={k('menu down')} style={{ right: 0 }}>
            {NEW_MENU.map(([key, ic, ov]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  set({ menu: null });
                  open(ov);
                }}
              >
                <PIcon name={ic} size={18} />
                {t(`shell.newMenu.${key as 'appointment'}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={k('rel')} data-menu>
        <button
          type="button"
          className={k('ibtn')}
          aria-label={t('shell.notificationsLabel', { count: unread })}
          aria-expanded={menu === 'n'}
          onClick={() => set({ menu: menu === 'n' ? null : 'n' })}
        >
          <PIcon name="bell" />
          {unread > 0 && <span className={k('badge')}>{unread}</span>}
        </button>
        {menu === 'n' && <Notifications d={d} onGo={a.go} />}
      </div>
      <WorkspaceSwitcher
        businessId={b.id}
        className={k('me')}
        label={t('shell.account', { name: b.ownerName })}
      >
        {initials(b.ownerName)}
      </WorkspaceSwitcher>
    </header>
  );
}

function Notifications({
  d,
  onGo,
}: {
  d: ProviderData;
  onGo: (p: 'marketing' | 'settings') => void;
}) {
  const f = useFmt();
  const { t } = f;
  const update = useProviderStore((s) => s.update);
  const ui = useUi();
  const status = useStatusNotifText();
  const when = (date: string) =>
    relKey(date, todayIso()) ? f.rel(date, todayIso()).toLowerCase() : f.rel(date, todayIso());
  const text = (n: ProviderNotification) => {
    const p = n.params;
    switch (n.kind) {
      case 'BOOKING_REQUESTED':
        return t('shell.notif.request', {
          name: p.name ?? '',
          service: p.service ?? '',
          when: p.date ? when(p.date) : '',
          time: p.time ?? '',
        });
      case 'BOOKING_CANCELLED':
        return t('shell.notif.cancelled', {
          name: p.name ?? '',
          when: p.date ? when(p.date) : '',
          time: p.time ?? '',
        });
      case 'NEW_REVIEW':
        return Number(p.stars) === 5
          ? t('shell.notif.review5', { name: p.name ?? '' })
          : t('shell.notif.reviewLow', { name: p.name ?? '', stars: Number(p.stars ?? 0) });
      default:
        return status(n.kind, p) ?? n.kind;
    }
  };
  const markRead = (id?: string) => {
    update((x) => {
      x.notifications.forEach((n) => {
        if (!id || n.id === id) n.unread = false;
      });
    });
    void (id ? readNotification(d.business.id, id) : readAllNotifications(d.business.id)).catch(
      () => {},
    );
  };
  const open = (n: ProviderNotification) => {
    markRead(n.id);
    ui.set({ menu: null });
    if (n.kind === 'BOOKING_REQUESTED') ui.open({ t: 'requests' });
    else if (n.kind === 'NEW_REVIEW') onGo('marketing');
    else if ((STATUS_KINDS as readonly string[]).includes(n.kind)) onGo('settings');
    else {
      const id = new URLSearchParams(n.route.split('?')[1] ?? '').get('appt');
      if (id && d.appointments.some((a) => a.id === id)) ui.open({ t: 'appt', id });
    }
  };
  return (
    <div className={k('pop')}>
      <div className={k('pop-h')}>
        <strong>{t('shell.notifications')}</strong>
        <button type="button" className={k('link quiet small')} onClick={() => markRead()}>
          {t('shell.markAllRead')}
        </button>
      </div>
      <div className={k('pop-b')}>
        {!d.notifications.length && (
          <p className={k('small muted')} style={{ padding: 16, margin: 0 }}>
            {t('shell.noNotifications')}
          </p>
        )}
        {d.notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            className={k('mi', n.unread && 'unread')}
            onClick={() => open(n)}
          >
            <PIcon name="bell" size={16} />
            <span>
              {text(n)}
              <span className={k('tiny muted')} style={{ display: 'block' }}>
                {f.ago(n.at)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
