'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { useSession, useSessionStore } from '@/lib/auth';
import { currentPosition, reverseGeocode } from '@/lib/geo';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { photoBg } from '@/lib/utils/photo';

import { AccountMenu } from '@/features/shop-account/components/AccountMenu';
import { Ic } from '@/features/shop-shared/components/Ic';
import { ItemPh, Modal, Ph, Spin } from '@/features/shop-shared/components/ui';
import { itemHref } from '@/features/shop-shared/components/cards';
import { useAuthGate, useFmt, useShopData } from '@/features/shop-shared/hooks';
import { cartTotals, initials, net, selTxt } from '@/features/shop-shared/rules';
import { useInbox } from '@/features/notification/hooks/useInbox';
import s from '@/features/shop-shared/shop.module.css';
import { toast, useShopStore, useShopUi } from '@/features/shop-shared/store';
import { searchHref } from '@/features/shop-search/util/searchParams';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const POPULAR = ['iced latte', 'massage', 'iPhone', 'krama', 'haircut', 'rice'];

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

function SearchBox() {
  const t = useTranslations('shop.header');
  const ts = useTranslations('shop.suggest');
  const f = useFmt();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { items, shops, item, shop } = useShopData();
  const recent = useShopStore((st) => st.recent);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const onSearch = pathname === '/search';
  const urlQ = onSearch ? (params.get('q') ?? '') : '';

  useEffect(() => setQ(urlQ), [urlQ, pathname]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const run = (text: string) => {
    setOpen(false);
    setQ(text);
    input.current?.blur();
    router.push(searchHref({ q: text }));
  };
  const pick = (id: string) => {
    useShopStore.getState().pushRecent(id);
    setOpen(false);
  };

  const query = q.trim().toLowerCase();
  const matchItems = query
    ? items
        .filter((i) => {
          const sh = shop(i.shop);
          return (i.name + (sh?.name ?? '') + (sh ? f.category(sh.catId) + sh.catId : ''))
            .toLowerCase()
            .includes(query);
        })
        .slice(0, 5)
    : [];
  const matchShops = query
    ? shops
        .filter((sh) => (sh.name + f.category(sh.catId) + sh.catId).toLowerCase().includes(query))
        .slice(0, 3)
    : [];

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const opts = [...(box.current?.querySelectorAll<HTMLElement>('[data-sg]') ?? [])];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && opts.length) {
      e.preventDefault();
      setIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length);
    }
    if (e.key === 'Enter' && idx >= 0 && opts[idx]) {
      e.preventDefault();
      opts[idx].click();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
    }
  };
  let k = -1;
  const sgCls = () => {
    k += 1;
    return cn(s.sg, k === idx && s.sgOn);
  };

  return (
    <div className={s.sbox} ref={box}>
      <form
        role="search"
        autoComplete="off"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          run(q.trim());
        }}
      >
        <input
          ref={input}
          type="search"
          role="combobox"
          value={q}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          aria-autocomplete="list"
          aria-controls="suggest"
          aria-expanded={open}
          onFocus={() => {
            setOpen(true);
            setIdx(-1);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setIdx(-1);
          }}
          onKeyDown={onKey}
        />
        <button type="submit" aria-label={t('searchLabel')}>
          <Ic name="search" size={18} strokeWidth={2.2} />
        </button>
      </form>
      {open && (
        <div className={s.suggest} id="suggest" role="listbox">
          {!query ? (
            <>
              {recent.length > 0 && (
                <>
                  <div className={s.sgH}>
                    <span>{ts('recent')}</span>
                    <button
                      className={cn(s.link, s.quiet, s.tiny)}
                      onClick={() => useShopStore.getState().set({ recent: [] })}
                    >
                      {ts('clear')}
                    </button>
                  </div>
                  {recent.map((id) => {
                    const it = item(id);
                    return it ? (
                      <Link
                        key={id}
                        data-sg=""
                        className={sgCls()}
                        href={itemHref(it)}
                        onClick={() => setOpen(false)}
                      >
                        <Ic name="history" size={18} />
                        <span>{it.name}</span>
                      </Link>
                    ) : null;
                  })}
                </>
              )}
              <div className={s.sgH}>
                <span>{ts('popular')}</span>
              </div>
              <div className={s.sgChips}>
                {POPULAR.map((p) => (
                  <button key={p} className={s.chip} onClick={() => run(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button data-sg="" className={sgCls()} onClick={() => run(q.trim())}>
                <Ic name="search" size={18} />
                <span>{ts.rich('searchFor', { q: q.trim(), b: (c) => <strong>{c}</strong> })}</span>
              </button>
              {matchItems.length > 0 && (
                <>
                  <div className={s.sgH}>
                    <span>{ts('items')}</span>
                  </div>
                  {matchItems.map((it) => (
                    <Link
                      key={it.id}
                      data-sg=""
                      className={sgCls()}
                      href={itemHref(it)}
                      onClick={() => pick(it.id)}
                    >
                      <ItemPh it={it} shop={shop(it.shop)} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block' }}>
                          <Highlight text={it.name} q={query} />
                        </span>
                        <span className={cn(s.tiny, s.muted)}>{shop(it.shop)?.name}</span>
                      </span>
                      <strong
                        className={cn('num', s.small, it.off > 0 && s.price, it.off > 0 && s.sale)}
                      >
                        {f.money(net(it))}
                      </strong>
                    </Link>
                  ))}
                </>
              )}
              {matchShops.length > 0 && (
                <>
                  <div className={s.sgH}>
                    <span>{ts('shops')}</span>
                  </div>
                  {matchShops.map((sh) => (
                    <Link
                      key={sh.id}
                      data-sg=""
                      className={sgCls()}
                      href={`/shop/${sh.id}`}
                      onClick={() => setOpen(false)}
                    >
                      <Ph hue={sh.hue} icon={sh.icon} photo={sh.logo} />
                      <span>
                        <span style={{ display: 'block' }}>
                          <Highlight text={sh.name} q={query} />
                        </span>
                        <span className={cn(s.tiny, s.muted)}>
                          {f.category(sh.catId)} · {f.district(sh.area)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </>
              )}
              {!matchItems.length && !matchShops.length && (
                <p className={cn(s.small, s.muted)} style={{ padding: '8px 10px' }}>
                  {ts('none')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NotifPop() {
  const t = useTranslations('shop.header');
  const f = useFmt();
  const inbox = useInbox();
  const setMenu = useShopUi((u) => u.setMenu);
  return (
    <div className={s.pop} role="menu">
      <div className={s.popH}>
        <strong>{t('notifications')}</strong>
        <button className={cn(s.link, s.quiet, s.small)} onClick={inbox.readAll}>
          {t('markAllRead')}
        </button>
      </div>
      <div className={s.popB}>
        {!inbox.items.length && (
          <p className={cn(s.small, s.muted)} style={{ padding: 16, margin: 0 }}>
            {t('noNotifications')}
          </p>
        )}
        {inbox.items.map((n) => (
          <Link
            key={n.id}
            className={cn(s.mi, n.unread && s.unread)}
            href={n.href}
            onClick={() => {
              inbox.read(n.id);
              setMenu(null);
            }}
          >
            <Ic name="bell" size={18} />
            <span>
              {inbox.text(n)}
              <span className={cn(s.tiny, s.muted)} style={{ display: 'block' }}>
                {f.ago(n.at)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MiniCart() {
  const t = useTranslations('shop.header');
  const f = useFmt();
  const { item, shop } = useShopData();
  const cart = useShopStore((st) => st.cart);
  const setMenu = useShopUi((u) => u.setMenu);
  const lines = cart.slice(-3).reverse();
  const tot = cartTotals(cart, item);
  return (
    <div className={s.pop} role="dialog" aria-label={t('cartPreview')}>
      <div className={s.popH}>
        <strong>{t('recentlyAdded')}</strong>
        <span className={cn(s.small, s.muted, 'num')}>{t('items', { count: tot.count })}</span>
      </div>
      <div className={s.popB}>
        {lines.length ? (
          lines.map((l, i) => {
            const it = item(l.pid);
            if (!it) return null;
            const st = selTxt(l.sel);
            return (
              <Link key={i} className={s.mi} href={itemHref(it)} onClick={() => setMenu(null)}>
                <ItemPh it={it} shop={shop(it.shop)} sel={l.sel} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {it.name}
                  </span>
                  <span className={cn(s.tiny, s.muted)}>
                    {st}
                    {st ? ' · ' : ''}× {l.qty}
                  </span>
                </span>
                <strong className={cn('num', s.small)}>{f.money(net(it, l.sel) * l.qty)}</strong>
              </Link>
            );
          })
        ) : (
          <p className={cn(s.muted, s.small)} style={{ padding: 12 }}>
            {t('cartEmpty')}
          </p>
        )}
      </div>
      {lines.length > 0 && (
        <div className={s.popF}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className={s.muted}>{t('subtotal')}</span>
            <strong className="num">{f.money(tot.total)}</strong>
          </div>
          <Link
            className={cn(s.btn, s.btnPrimary, s.btnBlock)}
            href="/cart"
            onClick={() => setMenu(null)}
          >
            {t('viewCart')}
          </Link>
        </div>
      )}
    </div>
  );
}

function DistrictSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('shop.loc');
  const tl = useTranslations('common.location');
  const tt = useTranslations('shop.toast');
  const f = useFmt();
  const locale = useLocale();
  const { districts } = useShopData();
  const area = useShopStore((st) => st.area);
  const here = useShopStore((st) => st.here);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<'denied' | 'unavailable' | null>(null);

  // GPS → nearest of our districts; the exact point is kept for distances.
  const locate = async () => {
    setErr(null);
    setBusy(true);
    try {
      const p = await currentPosition();
      const place = await reverseGeocode(p, locale).catch(() => null);
      const d = place?.district && districts.includes(place.district) ? place.district : area;
      useShopStore.getState().setHere(p, d);
      onClose();
      toast(tt('delivering', { area: [place?.line, f.district(d)].filter(Boolean).join(', ') }));
    } catch (e) {
      setErr((e as Error).message === 'DENIED' ? 'denied' : 'unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <p className={s.muted}>{t('body')}</p>
      <button
        type="button"
        className={cn(s.btn, s.btnGhost, s.btnBlock)}
        onClick={() => void locate()}
        disabled={busy}
      >
        {busy ? <Spin /> : <Ic name="pin" size={18} />}
        {busy ? tl('locating') : tl('useMine')}
      </button>
      {here && !busy && <p className={cn(s.small, s.muted)}>{t('usingExact')}</p>}
      {err && (
        <p className={cn(s.small)} role="alert" style={{ color: 'var(--sale)' }}>
          {tl(err)}
        </p>
      )}
      <div className={s.radios}>
        {districts.map((d) => (
          <label key={d} className={s.rad}>
            <input
              type="radio"
              name="dist"
              value={d}
              checked={d === area}
              onChange={() => {
                useShopStore.getState().setArea(d);
                onClose();
                toast(tt('delivering', { area: f.district(d) }));
              }}
            />
            <span>
              {f.district(d)}
              <small>{t('city')}</small>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function LogoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('shop.logout');
  const tt = useTranslations('shop.toast');
  const router = useRouter();
  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <p className={s.muted}>{t('body')}</p>
      <div className={s.btnPair}>
        <button className={cn(s.btn, s.btnGhost)} onClick={onClose}>
          {t('cancel')}
        </button>
        <button
          className={cn(s.btn, s.btnDanger)}
          onClick={() => {
            void useSessionStore.getState().signOut();
            useShopStore.getState().set({ co: null });
            onClose();
            router.push('/home');
            toast(tt('loggedOut'));
          }}
        >
          {t('confirm')}
        </button>
      </div>
    </Modal>
  );
}

export function ShopHeader() {
  const t = useTranslations('shop.header');
  const tc = useTranslations('shop');
  const f = useFmt();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const { categories } = useShopData();
  const area = useShopStore((st) => st.area);
  const cart = useShopStore((st) => st.cart);
  const { unread } = useInbox();
  const menu = useShopUi((u) => u.menu);
  const setMenu = useShopUi((u) => u.setMenu);
  const ask = useAuthGate((g) => g.ask);
  const loc = useShopUi((u) => u.loc);
  const setLoc = useShopUi((u) => u.setLoc);
  const [logout, setLogout] = useState(false);
  const right = useRef<HTMLDivElement>(null);
  const cartN = cart.reduce((a, c) => a + c.qty, 0);

  useEffect(() => setMenu(null), [pathname, setMenu]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest(`.${s.pop}, [data-menu-pop]`) && !el.closest('[data-menu-btn]'))
        setMenu(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, setMenu]);

  return (
    <header className={s.hdr}>
      <div className={cn(s.wrap, s.hdr1)}>
        <Link className={s.logo} href="/home" aria-label={t('homeLabel')}>
          <span className={s.logoMark}>B</span>
          <span>
            Virtual<b>Biz</b>
          </span>
        </Link>
        <button className={s.loc} onClick={() => setLoc(true)}>
          <Ic name="pin" size={20} />
          <span>
            <small>{t('deliverTo')}</small>
            <strong>
              {f.district(area)} <Ic name="down" size={14} />
            </strong>
          </span>
        </button>
        <SearchBox />
        <div className={s.hdrR} ref={right}>
          <LanguageSwitcher compact />
          <div className={cn(s.rel, s.hideM)}>
            <button
              className={s.ibtn}
              data-menu-btn=""
              aria-label={t('notifAria', { count: unread })}
              aria-expanded={menu === 'n'}
              onClick={() => setMenu(menu === 'n' ? null : 'n')}
            >
              <Ic name="bell" />
              {unread > 0 && <span className={s.badge}>{unread}</span>}
            </button>
            {menu === 'n' && <NotifPop />}
          </div>
          <Link className={cn(s.ibtn, s.hideM)} href="/account/saved" aria-label={t('saved')}>
            <Ic name="heart" />
          </Link>
          <div className={s.rel}>
            <Link
              className={s.ibtn}
              href="/cart"
              data-menu-btn=""
              aria-label={t('cartAria', { count: cartN })}
              onClick={(e) => {
                e.preventDefault();
                if (window.matchMedia('(max-width:700px)').matches || menu === 'c') {
                  setMenu(null);
                  router.push('/cart');
                } else setMenu('c');
              }}
            >
              <Ic name="cart" />
              {cartN > 0 && <span className={s.badge}>{cartN}</span>}
              <span className={s.lbl}>{t('cart')}</span>
            </Link>
            {menu === 'c' && <MiniCart />}
          </div>
          {user ? (
            <div className={s.rel}>
              <button
                className={s.ibtn}
                data-menu-btn=""
                aria-label={t('account')}
                aria-expanded={menu === 'u'}
                onClick={() => setMenu(menu === 'u' ? null : 'u')}
              >
                <span className={s.av} style={photoBg(user.avatarUrl)}>
                  {user.avatarUrl ? null : initials(user.name)}
                </span>
                <span className={s.lbl}>{user.name.split(' ')[0]}</span>
              </button>
              {menu === 'u' && (
                <AccountMenu
                  onLogout={() => {
                    setMenu(null);
                    setLogout(true);
                  }}
                />
              )}
            </div>
          ) : (
            <button
              className={cn(s.btn, s.btnPrimary, s.btnSm)}
              onClick={() => ask('continue', () => {})}
            >
              {t('login')}
            </button>
          )}
        </div>
      </div>
      <div className={s.wrap}>
        <nav className={s.cats} aria-label={t('categoriesLabel')}>
          <Link href={searchHref({ type: 'all' })}>{t('all')}</Link>
          {categories.map((c) => (
            <Fragment key={c.id}>
              <Link href={searchHref({ type: c.type, category: [c.id] })}>{f.category(c.id)}</Link>
            </Fragment>
          ))}
          <Link href="/deals" className={s.deal}>
            <Ic name="tag" size={14} /> {tc('tabs.deals')}
          </Link>
        </nav>
      </div>
      <DistrictSheet open={loc} onClose={() => setLoc(false)} />
      <LogoutSheet open={logout} onClose={() => setLogout(false)} />
    </header>
  );
}
