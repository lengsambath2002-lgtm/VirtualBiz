'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { EmptyView } from '@/components/feedback';
import { ClientAvatar, Stars } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { k } from '@/features/provider-shared/cx';
import { createDeal, deleteDeal, patchDeal, replyReview } from '@/features/provider-shared/api';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import type { ProviderDeal } from '@/features/provider-shared/types';
import { dealStatus, firstName } from '@/features/provider-shared/util/logic';
import { addDays, fmtD, isIsoDate, todayIso } from '@/features/provider-shared/util/time';
import { DateRangePicker } from '@/components/data';

const STATUS_TONE = { live: 'ok', scheduled: 'info', ended: 'neutral' } as const;

/** Deals and review replies (prototype `P.marketing`). */
export function MarketingPage() {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const avg = d.reviews.reduce((x, r) => x + r.stars, 0) / (d.reviews.length || 1);
  const unrep = d.reviews.filter((r) => !r.reply).length;
  const update = useProviderStore((s) => s.update);
  const actions = useActions();
  const search = useSearchParams();
  // `?tab=reviews` (the sidebar's count) opens the reviews to reply to.
  useEffect(() => {
    if (search.get('tab') === 'reviews') ui.set({ mkTab: 'reviews' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t('marketing.title')}</h1>
          <p className={k('muted')}>{t('marketing.sub')}</p>
        </div>
        {ui.mkTab === 'deals' && (
          <button
            type="button"
            className={k('btn btn-primary')}
            onClick={() => ui.open({ t: 'dealForm' })}
          >
            <PIcon name="plus" size={18} />
            {t('marketing.create')}
          </button>
        )}
      </div>
      <div className={k('seg')}>
        <button
          type="button"
          className={k(ui.mkTab === 'deals' && 'on')}
          onClick={() => ui.set({ mkTab: 'deals' })}
        >
          {t('marketing.deals')}
        </button>
        <button
          type="button"
          className={k(ui.mkTab === 'reviews' && 'on')}
          onClick={() => ui.set({ mkTab: 'reviews' })}
        >
          {t('marketing.reviews', { avg: avg.toFixed(1) })}
          {unrep > 0 && (
            <>
              {' '}
              <span className={k('pill warn')} style={{ padding: '0 6px' }}>
                {unrep}
              </span>
            </>
          )}
        </button>
      </div>
      {ui.mkTab === 'deals' ? (
        <section className={k('panel')}>
          {d.deals.length ? (
            d.deals.map((deal) => {
              const st = dealStatus(deal, today);
              return (
                <div
                  key={deal.id}
                  className={k('row')}
                  style={{ gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'start' }}
                >
                  <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <span className={k('pill', STATUS_TONE[st])}>{t(`marketing.${st}`)}</span>
                      <strong>{deal.title}</strong>
                    </div>
                    <span className={k('muted small')}>{deal.body}</span>
                    <span className={k('meta num')}>
                      {t('marketing.dealMeta', {
                        start: fmtD(deal.start, locale),
                        end: fmtD(deal.end, locale),
                        off: deal.discountPct,
                        services: deal.serviceIds
                          .map((x) => d.services.find((s) => s.id === x)?.name ?? '')
                          .join(', '),
                        views: deal.views,
                      })}
                    </span>
                  </div>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className={k('btn btn-ghost btn-sm')}
                      onClick={() => ui.open({ t: 'dealForm', id: deal.id })}
                    >
                      {st === 'ended' ? t('marketing.runAgain') : t('marketing.edit')}
                    </button>
                    <button
                      type="button"
                      className={k('ibtn')}
                      style={{ color: 'var(--danger)' }}
                      aria-label={t('marketing.delete', { title: deal.title })}
                      onClick={async () => {
                        const i = d.deals.findIndex((x) => x.id === deal.id);
                        try {
                          await deleteDeal(d.business.id, deal.id);
                        } catch (e) {
                          actions.fail(e);
                          return;
                        }
                        update((dd) => {
                          dd.deals = dd.deals.filter((x) => x.id !== deal.id);
                        });
                        // Undo creates it again (a new id) with the same details.
                        ui.showToast(t('marketing.deleted'), {
                          label: t('common.undo'),
                          fn: () =>
                            void createDeal(d.business.id, {
                              title: deal.title,
                              body: deal.body,
                              discountPct: deal.discountPct,
                              serviceIds: deal.serviceIds,
                              start: deal.start,
                              end: deal.end,
                            }).then(
                              (back) =>
                                update((dd) => {
                                  dd.deals.splice(i, 0, back);
                                }),
                              actions.fail,
                            ),
                        });
                      }}
                    >
                      <PIcon name="trash" size={18} />
                    </button>
                  </span>
                </div>
              );
            })
          ) : (
            <div className={k('empty')}>
              <strong>{t('marketing.noDeals')}</strong>
            </div>
          )}
        </section>
      ) : (
        <section className={k('panel')}>
          {!d.reviews.length && (
            <EmptyView title={t('marketing.noReviews')} body={t('marketing.noReviewsBody')} />
          )}
          {d.reviews.map((r) => {
            const c = { name: r.authorName };
            const s = d.services.find((x) => x.id === r.targetId);
            return (
              <div key={r.id} className={k('rv')}>
                <ClientAvatar c={c} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontWeight: 500 }}>{c.name}</strong>
                    <Stars n={r.stars} />
                    <span className={k('tiny muted')}>
                      {s?.name} · {f.ago(r.at)}
                    </span>
                  </div>
                  <p style={{ marginTop: 4 }}>{r.text}</p>
                  {r.reply ? (
                    <div className={k('reply')}>
                      <b style={{ fontWeight: 500 }}>{t('marketing.yourReply')}</b> · {r.reply}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={k('btn btn-ghost btn-sm')}
                      style={{ marginTop: 8 }}
                      onClick={() => ui.open({ t: 'reply', reviewId: r.id })}
                    >
                      <PIcon name="chat" size={16} />
                      {t('marketing.reply')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/** Create / edit / run again (prototype `dealForm`). */
export function DealForm({ id }: { id?: string }) {
  const { t, locale } = useFmt();
  const d = useData();
  const ui = useUi();
  const today = todayIso();
  const src = id ? d.deals.find((x) => x.id === id) : undefined;
  const rerun = !!src && src.end < today;
  const init = src
    ? { ...src, ...(rerun ? { start: today, end: addDays(today, 14) } : {}) }
    : {
        title: '',
        body: '',
        discountPct: 10,
        serviceIds: [] as string[],
        start: today,
        end: addDays(today, 14),
      };
  const [title, setTitle] = useState(init.title);
  const [body, setBody] = useState(init.body);
  const [off, setOff] = useState(String(init.discountPct));
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [svcs, setSvcs] = useState<string[]>(init.serviceIds);
  const [err, setErr] = useState<{ dt?: string; do?: string; de?: string; dv?: string }>({});

  const actions = useActions();
  const submit = async () => {
    const ti = title.trim();
    const o = parseFloat(off);
    const s = isIsoDate(start) ? start : today;
    const en = isIsoDate(end) ? end : today;
    const e = {
      dt: ti.length < 4 ? t('marketing.errTitle') : '',
      do: o > 0 && o < 100 ? '' : t('marketing.errOff'),
      de: en < s ? t('marketing.errEndBefore') : en < today ? t('marketing.errEndPast') : '',
      dv: svcs.length ? '' : t('marketing.errSvc'),
    };
    setErr(e);
    if (e.dt || e.do || e.de || e.dv) return;
    const data = {
      title: ti,
      body: body.trim(),
      discountPct: Math.round(o),
      start: s,
      end: en,
      serviceIds: svcs,
    };
    const bid = useProviderStore.getState().data!.business.id;
    let saved: ProviderDeal;
    try {
      saved = id && !rerun ? await patchDeal(bid, id, data) : await createDeal(bid, data);
    } catch (e) {
      actions.fail(e);
      return;
    }
    useProviderStore.getState().update((dd) => {
      const i = dd.deals.findIndex((x) => x.id === saved.id);
      if (i >= 0) dd.deals[i] = saved;
      else dd.deals.unshift(saved);
    });
    ui.close(true);
    ui.showToast(
      s > today
        ? t('marketing.toastScheduled', { date: fmtD(s, locale) })
        : t('marketing.toastLive'),
    );
  };

  return (
    <Modal wide>
      <h2>
        {!id
          ? t('marketing.titleCreate')
          : rerun
            ? t('marketing.titleRerun')
            : t('marketing.titleEdit')}
      </h2>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field id="dt2" label={t('marketing.dealTitle')} error={err.dt ?? ''}>
          <input
            id="dt2"
            maxLength={60}
            placeholder={t('marketing.dealTitlePh')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field id="db" label={t('marketing.desc')}>
          <textarea
            id="db"
            maxLength={200}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        <div className={k('g3')}>
          <Field id="do" label={t('marketing.off')} error={err.do ?? ''}>
            <input
              id="do"
              inputMode="numeric"
              value={off}
              onChange={(e) => setOff(e.target.value)}
            />
          </Field>
          <Field id="ds" label={t('marketing.starts')}>
            <DateRangePicker
              id="ds"
              mode="single"
              variant="field"
              label={t('marketing.starts')}
              from={start}
              to={start}
              clearable={false}
              onChange={(d) => {
                setStart(d);
                if (end && d > end) setEnd(d);
              }}
            />
          </Field>
          <Field id="de" label={t('marketing.ends')} error={err.de ?? ''}>
            <DateRangePicker
              id="de"
              mode="single"
              variant="field"
              label={t('marketing.ends')}
              from={end}
              to={end}
              clearable={false}
              min={start || undefined}
              invalid={!!err.de}
              onChange={(d) => setEnd(d)}
            />
          </Field>
        </div>
        <Field label={t('marketing.appliesTo')} error={err.dv ?? ''}>
          <div className={k('optg')}>
            {d.services.map((s) => (
              <label key={s.id} className={k('opt')}>
                <input
                  type="checkbox"
                  checked={svcs.includes(s.id)}
                  onChange={(e) =>
                    setSvcs((xs) =>
                      e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={k('btn btn-ghost')} onClick={() => ui.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={k('btn btn-primary')}>
            {t('marketing.publish')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Public reply with templates (prototype `reply` action). */
export function ReplyForm({ reviewId }: { reviewId: string }) {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const actions = useActions();
  const r = d.reviews.find((x) => x.id === reviewId);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  if (!r) return null;
  const name = r.authorName;
  const tpls = (r.stars <= 3 ? ['low1', 'low2'] : ['high1', 'high2']) as (
    | 'low1'
    | 'low2'
    | 'high1'
    | 'high2'
  )[];
  return (
    <Modal>
      <h2>{t('marketing.replyTitle', { name })}</h2>
      <div className={k('card')}>
        <Stars n={r.stars} />
        <p>{r.text}</p>
      </div>
      <div className={k('chips')}>
        {tpls.map((x) => (
          <button
            key={x}
            type="button"
            className={k('chip')}
            onClick={() =>
              setText(
                t('marketing.greeting', { name: firstName(name), text: t(`marketing.tpl.${x}`) }),
              )
            }
          >
            {t(`marketing.tpl.${x}Chip`)}
          </button>
        ))}
      </div>
      <Field id="rp" label={t('marketing.publicReply')} error={err}>
        <textarea id="rp" maxLength={400} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <button
        type="button"
        className={k('btn btn-primary')}
        onClick={async () => {
          const v = text.trim();
          if (v.length < 2) {
            setErr(t('marketing.errReply'));
            return;
          }
          try {
            await replyReview(d.business.id, reviewId, v);
          } catch (e) {
            actions.fail(e);
            return;
          }
          useProviderStore.getState().update((dd) => {
            const x = dd.reviews.find((y) => y.id === reviewId);
            if (x) x.reply = v;
          });
          ui.close(true);
          ui.showToast(t('marketing.posted'));
        }}
      >
        {t('marketing.post')}
      </button>
    </Modal>
  );
}
