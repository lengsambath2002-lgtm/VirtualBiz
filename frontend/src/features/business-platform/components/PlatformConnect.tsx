'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';

import { EmptyView, ErrorView, feedbackButton, StatusView } from '@/components/feedback';
import { useMyBusinesses, WORKSPACE_HREF } from '@/features/account-switcher';
import { isApiError, type MyBusiness } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { setActiveBusiness } from '@/lib/workspace';

import { connectShop } from '../api';
import { manages, type PlatformOrg } from '../types';
import { savedRoute, saveRoute } from '../util/pending';
import { goToPlatform, isUuid } from '../util/start';
import { PlatformMark } from './PlatformMark';
import { Redirecting } from './Redirecting';
import s from './platform.module.css';

/**
 * `/platform/connect?org={orgId}`: the platform's "Connect a shop" (and the shop settings'
 * Connect). First a platform sign-in with the connect intent; back here with `?step=choose`, the
 * person picks one of the shops they own and an organisation they own or administer, and connects.
 */
export function PlatformConnect() {
  const params = useSearchParams();
  const org = params.get('org');
  const business = params.get('business');
  const choosing = params.get('step') === 'choose';
  const [route] = useState(() => (choosing ? savedRoute() : null));

  if (choosing && route?.intent === 'connect')
    return (
      <Choose
        orgs={(route.orgs ?? []).filter(manages)}
        orgId={isUuid(org) ? org : null}
        businessId={isUuid(business) ? business : null}
      />
    );
  return (
    <Redirecting
      input={{
        intent: 'connect',
        ...(isUuid(org) ? { orgId: org } : {}),
        ...(isUuid(business) ? { businessId: business } : {}),
      }}
    />
  );
}

function Choose({
  orgs,
  orgId,
  businessId,
}: {
  orgs: PlatformOrg[];
  orgId: string | null;
  businessId: string | null;
}) {
  const t = useTranslations('platform.connect');
  const session = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useMyBusinesses();
  const owned = useMemo(() => (list.data ?? []).filter((b) => b.role === 'OWNER'), [list.data]);
  const [shop, setShop] = useState<string | null>(null);
  const [chosenOrg, setChosenOrg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; again?: boolean } | null>(null);
  const [done, setDone] = useState<{ shop: MyBusiness; org: string } | null>(null);

  const shopId = shop ?? (owned.find((b) => b.id === businessId) ?? owned[0])?.id ?? null;
  const orgPick = chosenOrg ?? (orgs.find((o) => o.id === orgId) ?? orgs[0])?.id ?? null;

  if (!session.ready || (session.user && !list.data && !list.error))
    return (
      <div className={s.wrap}>
        <div className={s.card} aria-busy="true">
          <span className={s.spin} aria-hidden="true" />
        </div>
      </div>
    );
  if (list.error) return <ErrorView error={list.error} retry={() => void list.refetch()} />;
  if (!session.user)
    return <Redirecting input={{ intent: 'connect', ...(orgId ? { orgId } : {}) }} />;

  if (done) {
    return (
      <div className={s.wrap}>
        <div className={s.card} role="status">
          <span className={s.mark}>
            <PlatformMark size={24} />
          </span>
          <h1>{t('doneTitle')}</h1>
          <p className={s.muted}>{t('doneBody', { shop: done.shop.name, org: done.org })}</p>
          <div className={s.btns}>
            <button
              type="button"
              className={s.primary}
              onClick={() => {
                setActiveBusiness(done.shop.type, done.shop.id);
                router.replace(WORKSPACE_HREF[done.shop.type]);
              }}
            >
              {t('openShop')}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!owned.length)
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <EmptyView
            size="panel"
            title={t('noShopsTitle')}
            body={t('noShopsBody')}
            action={
              <Link className={feedbackButton(true)} href="/create-business">
                {t('createShop')}
              </Link>
            }
          />
        </div>
      </div>
    );
  if (!orgs.length)
    return <StatusView kind="empty" title={t('noOrgsTitle')} body={t('noOrgsBody')} />;

  const orgName = (o: PlatformOrg) => o.name || o.slug || o.id;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shopId || !orgPick) return;
    setBusy(true);
    setErr(null);
    try {
      await connectShop(shopId, orgPick);
      saveRoute(null);
      void qc.invalidateQueries({ queryKey: ['business', shopId, 'platform'] });
      const o = orgs.find((x) => x.id === orgPick)!;
      setDone({ shop: owned.find((b) => b.id === shopId)!, org: orgName(o) });
    } catch (x) {
      setBusy(false);
      const reason = isApiError(x, 'FORBIDDEN') ? x.meta('reason') : null;
      if (reason === 'SIGN_IN_AGAIN' || reason === 'NOT_LINKED')
        return setErr({ text: t('expiredBody'), again: true });
      setErr({ text: isApiError(x, 'FORBIDDEN') ? t('forbidden') : t('failed') });
    }
  };

  return (
    <div className={s.wrap}>
      <form className={s.card} onSubmit={submit} aria-labelledby="pf-connect-title" noValidate>
        <span className={s.mark}>
          <PlatformMark size={24} />
        </span>
        <h1 id="pf-connect-title">{t('title')}</h1>
        <p className={s.muted}>{t('lead')}</p>
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>{t('shop')}</legend>
          <ul className={s.choices}>
            {owned.map((b) => (
              <li key={b.id}>
                <label className={s.choice}>
                  <input
                    type="radio"
                    name="shop"
                    checked={shopId === b.id}
                    onChange={() => setShop(b.id)}
                  />
                  <span>
                    <strong>{b.name}</strong>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>{t('org')}</legend>
          <ul className={s.choices}>
            {orgs.map((o) => (
              <li key={o.id}>
                <label className={s.choice}>
                  <input
                    type="radio"
                    name="org"
                    checked={orgPick === o.id}
                    onChange={() => setChosenOrg(o.id)}
                  />
                  <span>
                    <strong>{orgName(o)}</strong>
                    <small>{o.role === 'OWNER' ? t('roleOwner') : t('roleAdmin')}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {err && (
          <p className={s.err} role="alert">
            {err.text}
          </p>
        )}
        <div className={s.btns}>
          {err?.again ? (
            <button
              type="button"
              className={s.primary}
              onClick={() =>
                void goToPlatform({
                  intent: 'connect',
                  ...(orgPick ? { orgId: orgPick } : {}),
                  ...(shopId ? { businessId: shopId } : {}),
                })
              }
            >
              {t('connect')}
            </button>
          ) : (
            <button type="submit" className={s.primary} disabled={busy || !shopId || !orgPick}>
              {busy ? t('connecting') : t('connect')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
