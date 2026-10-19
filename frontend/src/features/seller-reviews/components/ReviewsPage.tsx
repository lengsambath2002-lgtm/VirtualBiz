'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { EmptyView } from '@/components/feedback';
import {
  cx,
  Ic,
  Modal,
  s,
  Stars,
  Thumb,
  useDb,
  useFmt,
  useSellerStore,
  useUi,
} from '@/features/seller-shared';
import { Link } from '@/lib/i18n/navigation';

export function ReviewsPage() {
  const t = useTranslations('seller.reviews');
  const db = useDb();
  const f = useFmt();
  const avg = db.reviews.reduce((x, r) => x + r.stars, 0) / (db.reviews.length || 1);
  return (
    <>
      <div className={s.phH}>
        <div>
          <h1>{t('title')}</h1>
          <p className={s.muted}>{t('sub', { avg: avg.toFixed(1) })}</p>
        </div>
      </div>
      <section className={s.panel}>
        {!db.reviews.length && <EmptyView title={t('emptyTitle')} body={t('emptyBody')} />}
        {db.reviews.map((r) => {
          const p = db.products.find((x) => x.id === r.targetId);
          return (
            <div key={r.id} className={s.rv}>
              <Thumb p={p} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontWeight: 500 }}>{r.authorId}</strong>
                  <Stars n={r.stars} />
                  <span className={cx(s.tiny, s.muted)}>
                    {t.rich('on', {
                      ago: f.ago(r.at),
                      title: p?.title ?? '',
                      a: (x) => (
                        <Link
                          href={`/seller/products/${r.targetId}`}
                          className={s.muted}
                          style={{ textDecoration: 'underline' }}
                        >
                          {x}
                        </Link>
                      ),
                    })}
                  </span>
                </div>
                <p style={{ marginTop: 4 }}>{r.text}</p>
                {r.reply ? (
                  <div className={s.reply}>
                    <b style={{ fontWeight: 500 }}>{t('yourReply')}</b> · {r.reply}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={cx(s.btn, s.btnGhost, s.btnSm)}
                    style={{ marginTop: 8 }}
                    onClick={() => useUi.getState().open({ kind: 'reply', id: r.id })}
                  >
                    <Ic name="chat" size={16} />
                    {t('reply')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

const SUGGEST_LOW = ['low1', 'low2'] as const;
const SUGGEST_HIGH = ['high1', 'high2'] as const;

export function ReplyDialog({ id }: { id: string }) {
  const t = useTranslations('seller.reviews');
  const db = useDb();
  const r = db.reviews.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  if (!r) return null;
  const first = r.authorId.split(' ')[0] ?? r.authorId;
  const keys = r.stars <= 3 ? SUGGEST_LOW : SUGGEST_HIGH;
  return (
    <Modal>
      <h2>{t('replyTo', { name: r.authorId })}</h2>
      <div className={s.card}>
        <Stars n={r.stars} />
        <p>{r.text}</p>
      </div>
      <div className={s.chips}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className={s.chip}
            onClick={() => {
              setText(t('hi', { name: first, text: t(`suggest.${k}`) }));
              setErr('');
            }}
          >
            {t(`suggestShort.${k}`)}…
          </button>
        ))}
      </div>
      <div className={cx(s.field, err && s.bad)}>
        <label htmlFor="rv-text">{t('publicReply')}</label>
        <textarea
          id="rv-text"
          maxLength={400}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className={s.err}>{err}</div>
      </div>
      <button
        type="button"
        className={cx(s.btn, s.btnPrimary)}
        onClick={async () => {
          const v = text.trim();
          if (v.length < 2) {
            setErr(t('errEmpty'));
            return;
          }
          if (!(await useSellerStore.getState().replyReview(r.id, v))) return;
          useUi.getState().close(true);
          useUi.getState().showToast(t('posted'));
        }}
      >
        {t('post')}
      </button>
    </Modal>
  );
}
