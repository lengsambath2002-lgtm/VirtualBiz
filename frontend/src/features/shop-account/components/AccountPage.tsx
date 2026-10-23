'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { Pagination, usePagedRows } from '@/components/data';
import { ErrorView } from '@/components/feedback';
import { passwordOk } from '@/features/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { BusinessLogo, useMyBusinesses, WORKSPACE_HREF } from '@/features/account-switcher';
import { fallbackErrorKey, isApiError, type ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { Link } from '@/lib/i18n/navigation';
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/utils/phone';
import { usePush } from '@/lib/firebase';
import { cn } from '@/lib/utils/cn';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import { photoBg } from '@/lib/utils/photo';

import { LogoutSheet } from '@/features/shop-layout/components/ShopHeader';
import { bookingLabel } from '@/features/shop-service-booking/components/BookingDetailPage';
import { isUpcoming } from '@/features/shop-service-booking/components/ServicePage';
import { useMyBookings } from '@/features/shop-service-booking/queries';
import { orderTotal } from '@/features/shop-order-tracking/components/OrderPage';
import { useReorder } from '@/features/shop-order-tracking/hooks/useReorder';
import { useMyOrders } from '@/features/shop-order-tracking/queries';
import { Ic, type IcName } from '@/features/shop-shared/components/Ic';
import { ProductCard, ShopCard } from '@/features/shop-shared/components/cards';
import { Field, addAddress } from '@/features/shop-shared/components/sheets';
import { Gate, ItemPh, Pill, Spin, type PillTone } from '@/features/shop-shared/components/ui';
import { useAuthGate, useFmt, useShopData } from '@/features/shop-shared/hooks';
import { hm, initials } from '@/features/shop-shared/rules';
import s from '@/features/shop-shared/shop.module.css';
import { useSavedKeys, useSavedLoad } from '@/features/shop-shared/saved';
import { toast } from '@/features/shop-shared/store';
import type { ShopBooking, ShopOrder } from '@/features/shop-shared/types';
import { searchHref } from '@/features/shop-search/util/searchParams';

import { orderBucket, useAccountCounts, type OrderBucket } from '../hooks/useAccountCounts';
import {
  useAddAddress,
  useAddresses,
  useChangePassword,
  useDeleteAddress,
  useMe,
  useSetDefaultAddress,
  useSetPrefs,
  useUpdateProfile,
} from '../queries';
import type { AccountTab } from '../types';
import a from './account.module.css';
import { ACCOUNT_ICONS } from './AccountMenu';

const NAV_GROUPS: { key: 'shopping' | 'settings'; tabs: AccountTab[] }[] = [
  { key: 'shopping', tabs: ['orders', 'bookings', 'saved'] },
  { key: 'settings', tabs: ['profile', 'addresses', 'settings'] },
];

const intlTag = (locale: string) => (locale === 'kh' ? 'km-KH' : 'en-GB');

function orderStatus(o: ShopOrder): [string, PillTone] {
  const pickup = o.method === 'PICKUP';
  if (o.status === 'CANCELLED') return ['cancelled', 'neutral'];
  if (o.status === 'RETURNED') return ['returned', 'neutral'];
  if (o.step >= 5) return [pickup ? 'pickedUp' : 'delivered', 'ok'];
  if (o.step === 4) return [pickup ? 'readyPickup' : 'onTheWay', 'warn'];
  return ['inProgress', 'info'];
}

function Empty({
  icon,
  title,
  hint,
  children,
}: {
  icon: IcName;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn(a.card, a.empty)}>
      <span className={a.emptyIc}>
        <Ic name={icon} size={24} />
      </span>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
      {children}
    </div>
  );
}

/* ===== Overview ===== */

function Overview() {
  const t = useTranslations('shop.account');
  const tl = useTranslations('shop.bookingStatus');
  const f = useFmt();
  const { user } = useSession();
  const { item, shop } = useShopData();
  const counts = useAccountCounts();
  const { data: orders = [] } = useMyOrders();
  const { bookings } = useMyBookings();
  const recent = orders.slice(0, 3);
  const next = bookings.filter(isUpcoming).sort((x, y) => x.date - y.date || x.start - y.start)[0];
  if (!user) return null;

  const stats: [string, number, IcName, string][] = [
    ['activeOrders', counts.activeOrders, 'truck', '/account/orders'],
    ['upcomingBookings', counts.upcomingBookings, 'calendar', '/account/bookings'],
    ['savedItems', counts.saved, 'heart', '/account/saved'],
    ['addresses', counts.addresses, 'pin', '/account/addresses'],
  ];
  const nextIt = next && item(next.serviceId);
  const nextSh = next && shop(next.businessId);

  return (
    <>
      <div className={cn(a.card, a.hero)}>
        <div>
          <h1>{t('hello', { name: user.name.split(' ')[0] ?? user.name })}</h1>
          <p>{t('overviewSub')}</p>
        </div>
      </div>
      <div className={a.stats}>
        {stats.map(([k, n, ic, href]) => (
          <Link key={k} href={href} className={cn(a.card, a.stat)}>
            <span className={a.statIc}>
              <Ic name={ic} size={18} />
            </span>
            <b className="num">{n}</b>
            <span>{t(`stats.${k}` as 'stats.activeOrders')}</span>
          </Link>
        ))}
      </div>
      <div className={a.cols}>
        <section className={cn(a.card, a.panel)}>
          <div className={a.panelH}>
            <h2>{t('recentOrders')}</h2>
            {orders.length > 0 && (
              <Link className={a.more} href="/account/orders">
                {t('viewAll')}
              </Link>
            )}
          </div>
          {recent.length ? (
            <div className={a.rows}>
              {recent.map((o) => {
                const first = o.lines[0]!;
                const it = item(first.pid);
                const [st, tone] = orderStatus(o);
                return (
                  <Link key={o.number} className={a.row} href={`/orders/${o.number}`}>
                    <span className={a.thumb}>
                      {it ? <ItemPh it={it} shop={shop(o.businessId)} sel={first.sel} /> : null}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <strong>{first.title}</strong>
                      <small className="num">
                        {o.number} · {f.fmtD(o.at)}
                      </small>
                    </span>
                    <span className={a.rowEnd}>
                      <b className="num">{f.money(orderTotal(o))}</b>
                      <Pill tone={tone}>{t(`status.${st}` as 'status.cancelled')}</Pill>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className={s.muted} style={{ fontSize: 14 }}>
              {t('noOrders')}.{' '}
              <Link href="/search" className={a.more}>
                {t('startShopping')}
              </Link>
            </p>
          )}
        </section>
        <section className={cn(a.card, a.panel)}>
          <div className={a.panelH}>
            <h2>{t('nextBooking')}</h2>
            {bookings.length > 0 && (
              <Link className={a.more} href="/account/bookings">
                {t('viewAll')}
              </Link>
            )}
          </div>
          {next && nextIt && nextSh ? (
            <Link className={a.row} href={`/bookings/${next.number}`}>
              <span className={a.thumb}>
                <ItemPh it={nextIt} shop={nextSh} />
              </span>
              <span style={{ minWidth: 0 }}>
                <strong>{nextIt.name}</strong>
                <small className="num">
                  {nextSh.name} · {f.fmtD(next.date)} {hm(next.start)}
                </small>
              </span>
              <Pill tone={bookingLabel(next)[1]}>{tl(bookingLabel(next)[0])}</Pill>
            </Link>
          ) : (
            <p className={s.muted} style={{ fontSize: 14 }}>
              {t('noUpcoming')}{' '}
              <Link href={searchHref({ type: 'service' })} className={a.more}>
                {t('findService')}
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}

/* ===== Orders ===== */

const FILTERS = ['all', 'active', 'done', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

/** A tab whose list failed to load: say so inside a card, with a retry. */
function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className={a.card}>
      <ErrorView error={error} retry={retry} size="panel" home={null} />
    </div>
  );
}

function Orders() {
  const t = useTranslations('shop.account');
  const tp = useTranslations('shop.payments');
  const tcm = useTranslations('common.payments');
  const f = useFmt();
  const reorder = useReorder();
  const { item, shop } = useShopData();
  const { data: orders = [], isPending, error, refetch } = useMyOrders();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders.length, active: 0, done: 0, cancelled: 0 };
    orders.forEach((o) => c[orderBucket(o)]++);
    return c;
  }, [orders]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...orders]
      .filter((o) => filter === 'all' || orderBucket(o) === (filter as OrderBucket))
      .filter(
        (o) =>
          !needle ||
          o.number.toLowerCase().includes(needle) ||
          o.lines.some((l) => l.title.toLowerCase().includes(needle)),
      );
  }, [orders, filter, q]);
  const paged = usePagedRows(shown, { resetOn: [filter, q] });

  if (isPending)
    return (
      <div className={cn(a.card, a.empty)}>
        <Spin />
      </div>
    );
  if (error && !orders.length) return <LoadError error={error} retry={() => void refetch()} />;
  if (!orders.length)
    return (
      <Empty icon="list" title={t('noOrders')}>
        <Link className={cn(s.btn, s.btnPrimary)} href="/search">
          {t('startShopping')}
        </Link>
      </Empty>
    );

  return (
    <>
      <div className={a.toolbar}>
        <div className={a.tabs} role="tablist" aria-label={t('tabs.orders')}>
          {FILTERS.map((k) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
              {t(`filters.${k}`)}
              <span className={cn(a.count, 'num')}>{counts[k]}</span>
            </button>
          ))}
        </div>
        <label className={a.search}>
          <Ic name="search" size={16} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchOrders')}
            aria-label={t('searchOrders')}
          />
        </label>
      </div>
      {shown.length ? (
        <div className={a.list}>
          {paged.rows.map((o) => {
            const sh = shop(o.businessId);
            const first = o.lines[0]!;
            const it = item(first.pid);
            const [st, tone] = orderStatus(o);
            const active = orderBucket(o) === 'active';
            const qty = o.lines.reduce((n, l) => n + l.qty, 0);
            return (
              <article key={o.number} className={cn(a.card, a.order)}>
                <div className={a.orderH}>
                  <div className={a.meta}>
                    <div>
                      <small>{t('orderCol')}</small>
                      <b className="num">{o.number}</b>
                    </div>
                    <div>
                      <small>{t('placedCol')}</small>
                      <b className="num">{f.fmtD(o.at)}</b>
                    </div>
                    <div>
                      <small>{t('total')}</small>
                      <b className="num">{f.money(orderTotal(o))}</b>
                    </div>
                  </div>
                  <Pill tone={tone}>{t(`status.${st}` as 'status.cancelled')}</Pill>
                </div>
                <div className={a.orderB}>
                  <span className={a.thumb}>
                    {it ? <ItemPh it={it} shop={sh} sel={first.sel} /> : null}
                  </span>
                  <span style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <Link href={`/shop/${o.businessId}`} className={a.shopLink}>
                      <Ic name="store" size={15} />
                      {sh?.name ?? o.shopName}
                    </Link>
                    <strong>
                      {first.title}
                      {o.lines.length > 1 && (
                        <span className={s.muted}> {t('more', { n: o.lines.length - 1 })}</span>
                      )}
                    </strong>
                    <small>
                      {t('itemsCount', { n: qty })} ·{' '}
                      {t(o.method === 'PICKUP' ? 'pickup' : 'delivery')} ·{' '}
                      {o.payment.method === 'KHQR' ? tcm('khqr') : tp(o.payment.method)}
                    </small>
                  </span>
                  <div className={a.actions}>
                    {orderBucket(o) === 'done' && (
                      <button className={cn(s.btn, s.btnGhost, s.btnSm)} onClick={() => reorder(o)}>
                        {t('buyAgain')}
                      </button>
                    )}
                    <Link
                      className={cn(s.btn, active ? s.btnPrimary : s.btnGhost, s.btnSm)}
                      href={`/orders/${o.number}`}
                    >
                      {active ? t('track') : t('viewDetails')}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          <Pagination {...paged.pager} />
        </div>
      ) : (
        <Empty icon="search" title={t('noMatch')} />
      )}
    </>
  );
}

/* ===== Bookings ===== */

function BookingRow({ b }: { b: ShopBooking }) {
  const tl = useTranslations('shop.bookingStatus');
  const f = useFmt();
  const { item, shop } = useShopData();
  const it = item(b.serviceId);
  const sh = shop(b.businessId);
  if (!it || !sh) return null;
  const [label, tone] = bookingLabel(b);
  const staff = sh.staff.find((m) => m.id === b.staffId)?.name;
  return (
    <Link className={a.row} href={`/bookings/${b.number}`}>
      <span className={a.thumb}>
        <ItemPh it={it} shop={sh} />
      </span>
      <span style={{ minWidth: 0 }}>
        <strong>{it.name}</strong>
        <small className="num">
          {sh.name} · {f.fmtD(b.date)} {hm(b.start)}
          {staff ? ' · ' + staff : ''}
        </small>
      </span>
      <Pill tone={tone}>{tl(label)}</Pill>
    </Link>
  );
}

function Bookings() {
  const t = useTranslations('shop.account');
  const { bookings, loading, error, retry } = useMyBookings();
  const up = bookings.filter(isUpcoming);
  const past = bookings.filter((b) => !isUpcoming(b));
  const [view, setView] = useState<'up' | 'past'>('up');
  const list = view === 'up' ? up : past;
  const paged = usePagedRows(list, { resetOn: [view] });
  if (loading)
    return (
      <div className={cn(a.card, a.empty)}>
        <Spin />
      </div>
    );
  if (error) return <LoadError error={error} retry={retry} />;
  if (!bookings.length)
    return (
      <Empty icon="calendar" title={t('nothingBooked')}>
        <Link className={cn(s.btn, s.btnPrimary)} href={searchHref({ type: 'service' })}>
          {t('findService')}
        </Link>
      </Empty>
    );
  return (
    <>
      <div className={a.toolbar}>
        <div className={a.tabs} role="tablist" aria-label={t('tabs.bookings')}>
          {(
            [
              ['up', t('upcoming'), up.length],
              ['past', t('past'), past.length],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>
              {label}
              <span className={cn(a.count, 'num')}>{n}</span>
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <section className={cn(a.card, a.panel)}>
          <div className={a.rows}>
            {paged.rows.map((b) => (
              <BookingRow key={b.number} b={b} />
            ))}
          </div>
          <Pagination {...paged.pager} />
        </section>
      ) : (
        <Empty icon="calendar" title={t('noUpcoming')}>
          <Link className={cn(s.btn, s.btnPrimary)} href={searchHref({ type: 'service' })}>
            {t('findService')}
          </Link>
        </Empty>
      )}
    </>
  );
}

/* ===== Saved ===== */

function Saved() {
  const t = useTranslations('shop.account');
  const { items, shops } = useShopData();
  const saved = useSavedKeys();
  const savedLoad = useSavedLoad();
  const its = items.filter((i) => saved.includes(i.id));
  const shs = shops.filter((sh) => saved.includes('shop:' + sh.id));
  const [view, setView] = useState<'items' | 'shops'>('items');
  const pagedItems = usePagedRows(its, { resetOn: [view] });
  const pagedShops = usePagedRows(shs, { prefix: 's', resetOn: [view] });
  if (savedLoad.error) return <LoadError error={savedLoad.error} retry={savedLoad.retry} />;
  return (
    <>
      <div className={a.toolbar}>
        <div className={a.tabs} role="tablist" aria-label={t('tabs.saved')}>
          {(
            [
              ['items', t('items'), its.length],
              ['shops', t('shops'), shs.length],
            ] as const
          ).map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}>
              {label}
              <span className={cn(a.count, 'num')}>{n}</span>
            </button>
          ))}
        </div>
      </div>
      {view === 'items' ? (
        its.length ? (
          <>
            <div className={cn(s.grid, s.g4)}>
              {pagedItems.rows.map((it) => (
                <ProductCard key={it.id} it={it} />
              ))}
            </div>
            <Pagination {...pagedItems.pager} />
          </>
        ) : (
          <Empty icon="heart" title={t('nothingSaved')} hint={t('nothingSavedHint')}>
            <Link className={cn(s.btn, s.btnPrimary)} href="/search">
              {t('browse')}
            </Link>
          </Empty>
        )
      ) : shs.length ? (
        <>
          <div className={s.shops}>
            {pagedShops.rows.map((sh) => (
              <ShopCard key={sh.id} sh={sh} />
            ))}
          </div>
          <Pagination {...pagedShops.pager} />
        </>
      ) : (
        <Empty icon="store" title={t('noShops')}>
          <Link className={cn(s.btn, s.btnPrimary)} href="/search">
            {t('browse')}
          </Link>
        </Empty>
      )}
    </>
  );
}

/* ===== Addresses ===== */

function Addresses() {
  const t = useTranslations('shop.account');
  const ta = useTranslations('shop.address');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const f = useFmt();
  const { data: addresses = [], isLoading, error, refetch } = useAddresses();
  const setDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();
  const restore = useAddAddress();
  const failed = (e: unknown) => toast(tc(fallbackErrorKey(e)));
  if (isLoading) return <div className={cn(a.card, a.panel)} aria-busy="true" />;
  if (error && !addresses.length) return <LoadError error={error} retry={() => void refetch()} />;
  if (!addresses.length)
    return (
      <Empty icon="pin" title={t('noAddresses')} hint={t('noAddressesHint')}>
        <button className={cn(s.btn, s.btnPrimary)} onClick={() => addAddress()}>
          <Ic name="plus" size={18} />
          {t('addAddress')}
        </button>
      </Empty>
    );
  return (
    <div className={a.addrs}>
      {addresses.map((ad) => (
        <div key={ad.id} className={cn(a.card, a.addr, ad.isDefault && a.addrDefault)}>
          <div className={a.addrH}>
            <strong>
              <Ic name="pin" size={16} />
              {ta(`labels.${ad.label}`)}
            </strong>
            {ad.isDefault && <Pill tone="warn">{t('default')}</Pill>}
          </div>
          <p>
            <b style={{ fontWeight: 600 }}>{ad.name}</b>
            <br />
            {t('addrLine', { line: ad.line, area: f.district(ad.district) })}
            <br />
            <span className="num">{f.phone(ad.phone)}</span>
            {ad.note ? (
              <>
                <br />
                <span className={s.muted}>{ad.note}</span>
              </>
            ) : null}
          </p>
          <div className={a.addrF}>
            {!ad.isDefault && (
              <button
                className={cn(s.btn, s.btnGhost, s.btnSm)}
                disabled={setDefault.isPending}
                onClick={() =>
                  setDefault.mutate(ad.id, {
                    onSuccess: () => toast(tt('defaultUpdated')),
                    onError: failed,
                  })
                }
              >
                {t('setDefault')}
              </button>
            )}
            <button
              className={cn(s.btn, s.btnGhost, s.btnSm)}
              style={{ marginLeft: 'auto' }}
              aria-label={t('deleteAddr', { label: ta(`labels.${ad.label}`) })}
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(ad.id, {
                  onError: failed,
                  onSuccess: () =>
                    toast(tt('addressDeleted'), {
                      label: tt('undo'),
                      // Undo saves the same address again (it gets a new id).
                      fn: () => {
                        const { id: _id, ...again } = ad;
                        restore.mutate(again, { onError: failed });
                      },
                    }),
                })
              }
            >
              <Ic name="trash" size={16} />
            </button>
          </div>
        </div>
      ))}
      <button className={a.addNew} onClick={() => addAddress()}>
        <Ic name="plus" size={22} />
        {t('addAddress')}
      </button>
    </div>
  );
}

/* ===== Profile & security ===== */

/**
 * Change the password; `first` sets one for an account that signs in with a code or Google only
 * (no current password to give).
 */
function PasswordRow({ first = false }: { first?: boolean }) {
  const t = useTranslations('shop.account');
  const tc = useTranslations('common');
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [errs, setErrs] = useState<{ cur?: string; next?: string }>({});
  const change = useChangePassword();
  const busy = change.isPending;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const cur = String(d.get('cur') ?? '');
    const next = String(d.get('next') ?? '');
    const n = {
      ...(!first && !cur ? { cur: t('errCurrent') } : {}),
      ...(!passwordOk(next) ? { next: t('errNewPw') } : {}),
    };
    setErrs(n);
    if (n.cur || n.next) return;
    try {
      await change.mutateAsync({ ...(first ? {} : { currentPassword: cur }), newPassword: next });
    } catch (err) {
      if (isApiError(err, 'INVALID_CREDENTIALS')) setErrs({ cur: t('errCurrent') });
      else if (isApiError(err, 'VALIDATION_FAILED')) setErrs({ next: t('errNewPw') });
      else toast(tc(fallbackErrorKey(err)));
      return;
    }
    setOpen(false);
    if (first && session.user)
      session.updateUser({ signInMethods: [...session.user.signInMethods, 'PASSWORD'] });
    toast(first ? t('pwSetDone') : t('pwChanged'));
  };
  return (
    <>
      <div className={a.kvRow}>
        <span>{t('password')}</span>
        {first ? <span className={s.muted}>{t('noPassword')}</span> : <span>••••••••</span>}
        {!open && (
          <button
            type="button"
            className={cn(s.btn, s.btnGhost, s.btnSm)}
            onClick={() => setOpen(true)}
          >
            {first ? t('setPassword') : t('changePassword')}
          </button>
        )}
      </div>
      {open && (
        <form className={a.pwForm} noValidate onSubmit={submit}>
          {first ? (
            <p className={s.muted} style={{ margin: 0, fontSize: 13 }}>
              {t('setPasswordHint')}
            </p>
          ) : (
            <Field id="pw-cur" label={t('currentPw')} error={errs.cur}>
              <input id="pw-cur" name="cur" type="password" autoComplete="current-password" />
            </Field>
          )}
          <Field
            id="pw-new"
            label={t('newPw')}
            error={errs.next}
            hint={errs.next ? undefined : t('errNewPw')}
          >
            <input id="pw-new" name="next" type="password" autoComplete="new-password" />
          </Field>
          <div className={a.formF}>
            <button
              type="button"
              className={cn(s.btn, s.btnGhost, s.btnSm)}
              onClick={() => {
                setOpen(false);
                setErrs({});
              }}
            >
              {t('cancel')}
            </button>
            <button className={cn(s.btn, s.btnPrimary, s.btnSm)} disabled={busy}>
              {first ? t('setPassword') : t('updatePw')}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/** Profile photo and cover: upload (`POST /api/files`), then `PATCH /api/me`. */
function ProfilePhotos() {
  const t = useTranslations('shop.account');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const { user } = useSession();
  const update = useUpdateProfile();
  const save = (patch: { avatarUrl?: string; coverUrl?: string }, removed = false) =>
    update.mutateAsync(patch).then(() => toast(tt(removed ? 'photoRemoved' : 'photoSaved')));
  const avatar = useImageUpload('AVATAR', (url) => save({ avatarUrl: url }), toast);
  const cover = useImageUpload('USER_COVER', (url) => save({ coverUrl: url }), toast);
  if (!user) return null;
  const remove = (patch: { avatarUrl?: string; coverUrl?: string }) =>
    void save(patch, true).catch((e: unknown) => toast(tc(fallbackErrorKey(e))));
  const busy = avatar.busy || cover.busy || update.isPending;
  return (
    <section className={cn(a.card, a.panel)} aria-labelledby="pf-photos">
      <div className={a.panelH}>
        <div>
          <h2 id="pf-photos">{t('photos')}</h2>
          <p>{t('photosHint')}</p>
        </div>
      </div>
      <div className={a.pCover} style={photoBg(user.coverUrl)} data-testid="profile-cover">
        <button
          type="button"
          className={cn(s.btn, s.btnGhost, s.btnSm, a.pCoverBtn)}
          disabled={busy}
          onClick={() => void cover.pick()}
        >
          {cover.busy
            ? tc('image.uploading')
            : user.coverUrl
              ? tc('image.changeCover')
              : tc('image.addCover')}
        </button>
      </div>
      <div className={a.pRow}>
        <span
          className={cn(a.av, a.pAv)}
          style={photoBg(user.avatarUrl)}
          data-testid="profile-avatar"
        >
          {user.avatarUrl ? null : initials(user.name)}
        </span>
        <div className={a.pBtns}>
          <button
            type="button"
            className={cn(s.btn, s.btnPrimary, s.btnSm)}
            disabled={busy}
            onClick={() => void avatar.pick()}
          >
            {avatar.busy
              ? tc('image.uploading')
              : user.avatarUrl
                ? tc('image.change')
                : tc('image.add')}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              className={cn(s.btn, s.btnGhost, s.btnSm)}
              disabled={busy}
              onClick={() => remove({ avatarUrl: '' })}
            >
              {tc('image.remove')}
            </button>
          )}
          {user.coverUrl && (
            <button
              type="button"
              className={cn(s.btn, s.btnGhost, s.btnSm)}
              disabled={busy}
              onClick={() => remove({ coverUrl: '' })}
            >
              {t('removeCover')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Profile() {
  const t = useTranslations('shop.account');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const { user } = useSession();
  const update = useUpdateProfile();
  const [errs, setErrs] = useState<{ name?: string; phone?: string }>({});
  if (!user) return null;
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const name = String(d.get('name') ?? '').trim();
    const phone = String(d.get('phone') ?? '');
    const next = {
      ...(name.length < 2 ? { name: t('errName') } : {}),
      ...(!isValidPhone(phone) ? { phone: t('errPhone') } : {}),
    };
    setErrs(next);
    if (next.name || next.phone) return;
    try {
      await update.mutateAsync({ name, phone: normalizePhone(phone) });
    } catch (err) {
      const field = (f: string) => isApiError(err) && (err as ApiError).field(f);
      if (isApiError(err, 'INVALID_PHONE') || field('phone')) setErrs({ phone: t('errPhone') });
      else if (field('name')) setErrs({ name: t('errName') });
      else toast(tc(fallbackErrorKey(err)));
      return;
    }
    toast(tt('profileSaved'));
  };
  return (
    <div className={a.sections}>
      <ProfilePhotos />
      <form className={cn(a.card, a.panel)} noValidate onSubmit={save}>
        <div className={a.panelH}>
          <h2>{t('personal')}</h2>
        </div>
        <div className={a.formGrid}>
          <Field id="pn" label={t('fullName')} error={errs.name}>
            <input id="pn" name="name" defaultValue={user.name} autoComplete="name" />
          </Field>
          <Field id="pp" label={t('phone')} error={errs.phone}>
            <input
              id="pp"
              name="phone"
              defaultValue={user.phone ? formatPhone(user.phone) : ''}
              inputMode="tel"
            />
          </Field>
        </div>
        <div className={a.formF}>
          <button className={cn(s.btn, s.btnPrimary)} disabled={update.isPending}>
            {t('save')}
          </button>
        </div>
      </form>

      <section className={cn(a.card, a.panel)}>
        <div className={a.panelH}>
          <h2>{t('security')}</h2>
        </div>
        <div className={a.kv}>
          <div className={a.kvRow}>
            <span>{t('email')}</span>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{user.email ?? '—'}</span>
            {user.email && <Pill tone="ok">{t('verified')}</Pill>}
          </div>
          <div className={a.kvRow}>
            <span>{t('signInWith')}</span>
            <span className={a.chips}>
              {user.signInMethods.map((m) => (
                <Pill key={m} tone="neutral">
                  {t(`methods.${m}`)}
                </Pill>
              ))}
            </span>
            <span />
          </div>
        </div>
      </section>
    </div>
  );
}

/** Push notifications on this browser (Firebase Cloud Messaging, docs/ops/firebase.md). */
function PushRow() {
  const t = useTranslations('shop.account');
  const tc = useTranslations('common');
  const { state, busy, turnOn, turnOff } = usePush();
  if (state === null || state === 'unsupported') return null;
  const hint = state === 'denied' ? t('prefPushDenied') : t('prefPushHint');
  return (
    <label className={a.toggle}>
      <span>
        {t('prefPush')}
        <small>{hint}</small>
      </span>
      <input
        className={a.switch}
        type="checkbox"
        checked={state === 'on'}
        disabled={busy || state === 'denied'}
        onChange={(e) =>
          (e.target.checked ? turnOn() : turnOff()).catch((err: unknown) => toast(tc(fallbackErrorKey(err))))
        }
      />
    </label>
  );
}

function Settings() {
  const t = useTranslations('shop.account');
  const tt = useTranslations('shop.toast');
  const tc = useTranslations('common');
  const { user } = useSession();
  const me = useMe();
  const savePrefs = useSetPrefs();
  const prefs = me.data?.prefs;
  const [logout, setLogout] = useState(false);
  if (!user) return null;
  const hasPassword = user.signInMethods.includes('PASSWORD');
  const setPref = (k: 'deals' | 'promos' | 'emails', v: boolean) => {
    if (!prefs) return;
    savePrefs.mutate(
      { ...prefs, [k]: v },
      {
        onSuccess: () => toast(tt('settingsSaved')),
        onError: (e) => toast(tc(fallbackErrorKey(e))),
      },
    );
  };
  return (
    <div className={a.sections}>
      <section className={cn(a.card, a.panel)}>
        <div className={a.panelH}>
          <h2>{t('notifications')}</h2>
        </div>
        <div>
          <label className={a.toggle}>
            <span>
              {t('prefOrders')}
              <small>{t('alwaysOn')}</small>
            </span>
            <input className={a.switch} type="checkbox" checked disabled readOnly />
          </label>
          <label className={a.toggle}>
            <span>
              {t('prefEmails')}
              <small>{t('prefEmailsHint', { email: user.email ?? '' })}</small>
            </span>
            <input
              className={a.switch}
              type="checkbox"
              checked={prefs?.emails ?? true}
              disabled={!prefs || !user.email}
              onChange={(e) => setPref('emails', e.target.checked)}
            />
          </label>
          <PushRow />
          <label className={a.toggle}>
            <span>{t('prefDeals')}</span>
            <input
              className={a.switch}
              type="checkbox"
              checked={prefs?.deals ?? false}
              disabled={!prefs}
              onChange={(e) => setPref('deals', e.target.checked)}
            />
          </label>
          <label className={a.toggle}>
            <span>{t('prefPromos')}</span>
            <input
              className={a.switch}
              type="checkbox"
              checked={prefs?.promos ?? false}
              disabled={!prefs}
              onChange={(e) => setPref('promos', e.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className={cn(a.card, a.panel)}>
        <div className={a.panelH}>
          <h2>{t('password')}</h2>
        </div>
        <div className={a.kv}>
          {user.email && hasPassword ? (
            <PasswordRow />
          ) : user.email ? (
            <PasswordRow first />
          ) : (
            <div className={a.kvRow}>
              <span>{t('password')}</span>
              <span className={s.muted}>{t('noPassword')}</span>
              <span />
            </div>
          )}
        </div>
      </section>

      <section className={cn(a.card, a.panel, a.dangerRow)}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t('language')}</h2>
          <p className={s.muted} style={{ fontSize: 13, marginTop: 2 }}>
            {t('languageHint')}
          </p>
        </div>
        <LanguageSwitcher />
      </section>

      <section className={cn(a.card, a.panel, a.dangerRow)}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t('logout')}</h2>
          <p className={s.muted} style={{ fontSize: 13, marginTop: 2 }}>
            {t('logoutHint')}
          </p>
        </div>
        <button
          type="button"
          className={cn(s.btn, s.btnGhost)}
          style={{ color: 'var(--sale)' }}
          onClick={() => setLogout(true)}
        >
          <Ic name="logout" size={18} />
          {t('logout')}
        </button>
      </section>
      <LogoutSheet open={logout} onClose={() => setLogout(false)} />
    </div>
  );
}

/* ===== Shell ===== */

function Sidebar({ tab, onLogout }: { tab: AccountTab; onLogout: () => void }) {
  const t = useTranslations('shop.account');
  const locale = useLocale();
  const { user } = useSession();
  const counts = useAccountCounts();
  const { data: businesses = [] } = useMyBusinesses();
  const [allBiz, setAllBiz] = useState(false);
  if (!user) return null;
  const badge: Partial<Record<AccountTab, number>> = {
    orders: counts.activeOrders,
    bookings: counts.upcomingBookings,
    saved: counts.saved,
  };
  const since = new Date(user.createdAt).toLocaleDateString(intlTag(locale), {
    month: 'short',
    year: 'numeric',
  });
  const navItem = (k: AccountTab) => (
    <Link
      key={k}
      href={`/account/${k}`}
      className={a.sItem}
      aria-current={tab === k ? 'page' : undefined}
    >
      <Ic name={ACCOUNT_ICONS[k]} size={18} />
      <span>{t(`tabs.${k}`)}</span>
      {!!badge[k] && <span className={cn(a.sBadge, 'num')}>{badge[k]}</span>}
    </Link>
  );
  return (
    <aside className={a.side}>
      <div className={cn(a.card, a.sCard)}>
        <div className={a.sWho}>
          <div className={a.sBand} style={photoBg(user.coverUrl)} aria-hidden="true" />
          <span className={cn(a.av, a.sAv)} style={photoBg(user.avatarUrl)}>
            {user.avatarUrl ? null : initials(user.name)}
          </span>
          <strong>{user.name}</strong>
          {user.email && <span className={a.sMail}>{user.email}</span>}
          <span className={a.sSince}>{t('memberSince', { date: since })}</span>
          <Link href="/account/profile" className={a.sEdit}>
            {t('editProfile')}
          </Link>
        </div>
        <nav className={a.sNav} aria-label={t('title')}>
          {navItem('overview')}
          {NAV_GROUPS.map((g) => (
            <div key={g.key} className={a.sGroup} role="group" aria-label={t(`groups.${g.key}`)}>
              <div className={a.sLabel}>{t(`groups.${g.key}`)}</div>
              {g.tabs.map(navItem)}
            </div>
          ))}
        </nav>
        <div className={a.sFoot}>
          <Link href="/help" className={a.sFootBtn}>
            <Ic name="help" size={16} />
            {t('help')}
          </Link>
          <button type="button" className={cn(a.sFootBtn, a.sOut)} onClick={onLogout}>
            <Ic name="logout" size={16} />
            {t('logout')}
          </button>
        </div>
      </div>
      <div className={cn(a.card, a.biz)}>
        <strong>{t('yourBusiness')}</strong>
        <span>{t('yourBusinessHint')}</span>
        <div className={a.bizLinks}>
          {(allBiz ? businesses : businesses.slice(0, 5)).map((b) => (
            <Link key={b.id} href={WORKSPACE_HREF[b.type]}>
              <BusinessLogo b={b} size={32} />
              <span className={a.bizName}>
                {b.name}
                <small>{t(b.type === 'SERVICE' ? 'serviceShop' : 'productShop')}</small>
              </span>
              <Ic name="right" size={14} className={a.chev} />
            </Link>
          ))}
          {businesses.length > 5 && (
            <button type="button" className={a.bizMore} onClick={() => setAllBiz((x) => !x)}>
              {allBiz ? t('fewerBusinesses') : t('allBusinesses', { n: businesses.length })}
            </button>
          )}
          <Link href={{ pathname: '/create-business', query: { new: '1' } }}>
            <Ic name="plus" size={18} />
            {t('newBusiness')}
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function AccountPage({ tab }: { tab: AccountTab }) {
  const t = useTranslations('shop.account');
  const tg = useTranslations('shop.gate');
  const { user } = useSession();
  const ask = useAuthGate((g) => g.ask);
  const [logout, setLogout] = useState(false);
  if (!user) return <Gate title={tg('account')} onLogin={() => ask('continue', () => {})} />;
  return (
    <div>
      <nav className={a.crumbs} aria-label={t('breadcrumb')}>
        <Link href="/home">{t('home')}</Link>
        <Ic name="right" size={12} />
        <Link href="/account/overview">{t('title')}</Link>
        {tab !== 'overview' && (
          <>
            <Ic name="right" size={12} />
            <span aria-current="page">{t(`tabs.${tab}`)}</span>
          </>
        )}
      </nav>
      <div className={a.page}>
        <Sidebar tab={tab} onLogout={() => setLogout(true)} />
        <div className={a.main}>
          {tab === 'overview' ? (
            <Overview />
          ) : (
            <>
              <div className={a.head}>
                <div>
                  <h1>{t(`tabs.${tab}`)}</h1>
                  <p>{t(`sub.${tab}`)}</p>
                </div>
              </div>
              {tab === 'orders' && <Orders />}
              {tab === 'bookings' && <Bookings />}
              {tab === 'saved' && <Saved />}
              {tab === 'addresses' && <Addresses />}
              {tab === 'profile' && <Profile />}
              {tab === 'settings' && <Settings />}
            </>
          )}
        </div>
      </div>
      <LogoutSheet open={logout} onClose={() => setLogout(false)} />
    </div>
  );
}
