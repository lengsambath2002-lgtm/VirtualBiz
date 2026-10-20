'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

import type { BusinessDraft, TodoKey } from '../types';
import { SHOP_HOST, shopSlug } from '../util/draft';
import { OnbIcon } from './icons';
import s from './onboarding.module.css';

interface DoneScreenProps {
  draft: BusinessDraft;
  onTodo: (key: TodoKey) => void;
  onShare: () => void;
  onCopy: () => void;
}

/** Where each "Get ready" item opens in the business's workspace. */
function todoHref(key: Exclude<TodoKey, 'share'>, service: boolean): string {
  if (key === 'first') return service ? '/provider/services' : '/seller/products/new';
  if (key === 'team') return service ? '/provider/team' : '/seller/team';
  return service ? '/provider/settings' : '/seller/settings';
}

/** "<Shop> is open!": ID-check banner, the "Get ready" checklist and the shop link. */
export function DoneScreen({ draft, onTodo, onShare, onCopy }: DoneScreenProps) {
  const t = useTranslations('onboarding.done');
  const service = draft.type === 'service';
  const items: [TodoKey, string, string][] = [
    [
      'first',
      service ? t('firstService') : t('firstProduct'),
      service ? t('firstHintService') : t('firstHintProduct'),
    ],
    ['logo', t('logo'), t('logoHint')],
    ['team', t('team'), t('teamHint')],
    ['share', t('share'), t('shareHint')],
  ];
  const n = items.filter(([k]) => draft.todo[k]).length;

  return (
    <>
      <div className={cn(s.heroIc, s.t3)}>
        <OnbIcon name="check" size={32} />
      </div>
      <div>
        <h1 className={s.h1}>{t('title', { name: draft.name })}</h1>
        <p className={s.lead}>{t('lead')}</p>
      </div>
      {!draft.bakong.trim() ? (
        <div className={cn(s.banner, s.bWarn)} role="status">
          <OnbIcon name="clock" size={18} />
          <span>{t('noPayout')}</span>
        </div>
      ) : draft.verified ? (
        <div className={cn(s.banner, s.bOk)}>
          <OnbIcon name="check" size={18} />
          <span>
            {t.rich('verified', {
              bakong: draft.bakong,
              mono: (c) => <b className={s.mono}>{c}</b>,
            })}
          </span>
        </div>
      ) : (
        <div className={cn(s.banner, s.bWarn)} role="status">
          <OnbIcon name="clock" size={18} />
          <span>{t('pending')}</span>
        </div>
      )}
      <div className={s.group}>
        <div className={cn(s.groupT, s.groupTSplit)}>
          <span>{t('getReady')}</span>
          <span className={s.num}>{t('progress', { done: n, total: items.length })}</span>
        </div>
        <div className={cn(s.list, s.panel)}>
          {items.map(([k, title, hint], i) => {
            const body = (
              <>
                <span className={s.c}>
                  <OnbIcon name="check" size={14} />
                </span>
                <span>
                  <span
                    className={s.l}
                    style={{ fontWeight: i === 0 && !draft.todo[k] ? 600 : 500 }}
                  >
                    {title}
                  </span>
                  <span className={cn(s.small, s.muted, s.block)}>{hint}</span>
                </span>
                <span className={s.muted}>
                  <OnbIcon name="chev" size={18} />
                </span>
              </>
            );
            const cls = cn(s.todo, draft.todo[k] && s.done);
            return k === 'share' ? (
              <button key={k} type="button" className={cls} onClick={onShare}>
                {body}
              </button>
            ) : (
              <Link key={k} href={todoHref(k, service)} className={cls} onClick={() => onTodo(k)}>
                {body}
              </Link>
            );
          })}
        </div>
      </div>
      <div className={cn(s.list, s.panel)}>
        <div className={s.item}>
          <span style={{ minWidth: 0 }}>
            <span className={cn(s.small, s.muted)}>{t('shopLink')}</span>
            <b className={s.shopLink}>
              {SHOP_HOST}/{shopSlug(draft.name)}
            </b>
          </span>
          <button type="button" className={cn(s.btn, s.btnSm, s.btnGhost)} onClick={onCopy}>
            <OnbIcon name="copy" size={16} />
            {t('copy')}
          </button>
        </div>
      </div>
    </>
  );
}
