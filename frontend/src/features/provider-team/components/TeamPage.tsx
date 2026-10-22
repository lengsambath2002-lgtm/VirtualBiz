'use client';

import { useTranslations } from 'next-intl';

import { Fragment, useState } from 'react';

import { EmptyView } from '@/components/feedback';
import { TeamAccess } from '@/features/business-team';
import type { DayRange, WeekRanges } from '@/lib/domain';

import { StaffAvatar } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { Field, Modal } from '@/features/provider-shared/components/Overlay';
import { addMember, patchMember } from '@/features/provider-shared/api';
import { ActivityLog } from '@/features/business-activity';
import { Link } from '@/lib/i18n/navigation';
import { k } from '@/features/provider-shared/cx';
import { useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import { STAFF_COLORS } from '@/features/provider-shared/types';
import { firstName } from '@/features/provider-shared/util/logic';
import { addDays, H0, H1, hm, todayIso, toMin } from '@/features/provider-shared/util/time';
import type { BusinessMember } from '@/lib/domain';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** "Owner · Senior stylist", or just the title. */
export function useRoleLabel() {
  const { t } = useFmt();
  return (m: Pick<BusinessMember, 'role' | 'title'>) =>
    m.role === 'OWNER' ? [t('team.owner'), m.title].filter(Boolean).join(' · ') : (m.title ?? '');
}

/** Team cards with weekly shifts (prototype `P.team`). */
export function TeamPage() {
  const f = useFmt();
  const { t } = f;
  const d = useData();
  const ui = useUi();
  const roleLabel = useRoleLabel();
  const ta = useTranslations('activity');
  const from7 = addDays(todayIso(), -7);
  return (
    <>
      <div className={k('ph-h')}>
        <div>
          <h1>{t('team.title')}</h1>
          <p className={k('muted')}>{t('team.sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/provider/activity" className={k('btn btn-ghost')}>
            {ta('open')}
          </Link>
          <button
            type="button"
            className={k('btn btn-primary')}
            onClick={() => ui.open({ t: 'staffForm' })}
          >
            <PIcon name="plus" size={18} />
            {t('team.add')}
          </button>
        </div>
      </div>
      {!d.staff.length && (
        <section className={k('panel')}>
          <EmptyView title={t('team.emptyTitle')} body={t('team.emptyBody')} />
        </section>
      )}
      <div className={k('team')}>
        {d.staff.map((st) => {
          const wk = d.appointments.filter(
            (a) => a.staffId === st.id && a.status === 'COMPLETED' && a.date > from7,
          );
          const rev = wk.reduce((x, a) => x + a.price, 0);
          const hrs = st.shifts.reduce((x, s) => x + (s ? (s[1] - s[0]) / 60 : 0), 0);
          const does = d.services.filter((s) => s.staffIds.includes(st.id)).map((s) => s.name);
          return (
            <section key={st.id} className={k('panel')}>
              <div className={k('panel-b')}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <StaffAvatar m={st} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontWeight: 600, fontSize: 15 }}>{st.name}</strong>
                    <div className={k('meta')}>{roleLabel(st)}</div>
                  </div>
                  <button
                    type="button"
                    className={k('ibtn')}
                    aria-label={t('team.edit', { name: st.name })}
                    onClick={() => ui.open({ t: 'staffForm', id: st.id })}
                  >
                    <PIcon name="edit" size={18} />
                  </button>
                </div>
                <div className={k('g3')} style={{ textAlign: 'center' }}>
                  {(
                    [
                      [t('team.hoursWeek'), hrs],
                      [t('team.clients7'), wk.length],
                      [t('team.sales7'), f.money0(rev)],
                    ] as const
                  ).map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--sunk)', borderRadius: 8, padding: 8 }}>
                      <b className={k('num')}>{v}</b>
                      <div className={k('tiny muted')}>{l}</div>
                    </div>
                  ))}
                </div>
                <div className={k('shift')}>
                  {DAYS.map((i) => {
                    const s = st.shifts[i];
                    return (
                      <Fragment key={i}>
                        <span className={k('muted')}>{t(`days.short.${i}`)}</span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={k('bar')} style={{ flex: 1 }}>
                            {s && (
                              <b
                                style={{
                                  left: `${((s[0] / 60 - H0) / (H1 - H0)) * 100}%`,
                                  width: `${((s[1] - s[0]) / 60 / (H1 - H0)) * 100}%`,
                                  background: st.color,
                                }}
                              />
                            )}
                          </span>
                          <span className={k('num tiny')} style={{ width: 72, textAlign: 'right' }}>
                            {s ? `${hm(s[0])}–${hm(s[1])}` : t('team.off')}
                          </span>
                        </span>
                      </Fragment>
                    );
                  })}
                </div>
                <div className={k('meta')}>
                  {t('team.does', { list: does.join(', ') || t('team.noServices') })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <TeamAccess businessId={d.business.id} />
      </div>
    </>
  );
}

/** Add / edit team member with colour and weekly shifts (prototype `staffForm`). */
export function StaffForm({ id }: { id?: string }) {
  const { t } = useFmt();
  const d = useData();
  const ui = useUi();
  const roleLabel = useRoleLabel();
  const st = id ? d.staff.find((m) => m.id === id) : undefined;
  const [name, setName] = useState(st?.name ?? '');
  const [role, setRole] = useState(st ? roleLabel(st) : t('team.defaultRole'));
  const [color, setColor] = useState<string>(st?.color ?? '#E07B39');
  const init: WeekRanges =
    st?.shifts ?? ([...Array(6).fill([540, 1080]), null] as unknown as WeekRanges);
  const [on, setOn] = useState<boolean[]>(init.map((s) => !!s));
  const [times, setTimes] = useState<[string, string][]>(
    init.map((s) => [hm((s ?? [540, 1080])[0]), hm((s ?? [540, 1080])[1])]),
  );
  const [err, setErr] = useState<{ tn?: string; sh?: string }>({});
  const actions = useActions();

  const submit = async () => {
    const n = name.trim();
    if (n.length < 2) {
      setErr({ tn: t('team.errName') });
      return;
    }
    const shifts = DAYS.map((i): DayRange => {
      if (!on[i]) return null;
      const [a, b] = times[i]!.map((x) => Math.round(toMin(x) / 15) * 15) as [number, number];
      return [a, b];
    }) as WeekRanges;
    if (shifts.some((s) => s && s[1] <= s[0])) {
      setErr({ sh: t('team.errShift') });
      return;
    }
    // The prototype's role is free text; the owner keeps OWNER and the text becomes the title.
    const ownerPrefix = `${t('team.owner')} · `;
    const title =
      st?.role === 'OWNER' && role.startsWith(ownerPrefix)
        ? role.slice(ownerPrefix.length)
        : role.trim();
    const bid = d.business.id;
    const input = { name: n, title, color, shifts };
    let saved: BusinessMember;
    try {
      saved = st
        ? await patchMember(bid, st.id, input, d.business.hours)
        : await addMember(bid, input, d.business.hours);
    } catch (e) {
      actions.fail(e);
      return;
    }
    useProviderStore.getState().update((dd) => {
      const i = dd.staff.findIndex((m) => m.id === saved.id);
      if (i >= 0) dd.staff[i] = saved;
      else dd.staff.push(saved);
    });
    ui.close(true);
    ui.showToast(st ? t('team.saved') : t('team.added', { name: n }));
  };

  return (
    <Modal wide>
      <h2>{st ? t('team.titleEdit', { name: firstName(st.name) }) : t('team.titleAdd')}</h2>
      <form
        className={k('form')}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={k('g2')}>
          <Field id="tn" label={t('team.name')} error={err.tn ?? ''}>
            <input id="tn" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="tr" label={t('team.role')}>
            <input id="tr" value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
        </div>
        <Field label={t('team.colour')}>
          <div className={k('chips')} role="radiogroup">
            {STAFF_COLORS.map((c, i) => (
              <label key={c} style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="tc"
                  value={c}
                  checked={c === color}
                  onChange={() => setColor(c)}
                  aria-label={t('team.colourOpt', { n: i + 1 })}
                  style={{ position: 'absolute', opacity: 0 }}
                />
                <span
                  style={{
                    display: 'block',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: c,
                    boxShadow: c === color ? `0 0 0 3px var(--surface),0 0 0 5px ${c}` : 'none',
                  }}
                />
              </label>
            ))}
          </div>
        </Field>
        <div className={k('field')}>
          <span className={k('lbl')}>{t('team.shifts')}</span>
          <div className={k('hours')}>
            {DAYS.map((i) => {
              const day = t(`days.long.${i}`);
              return (
                <div key={i} className={k('hour')}>
                  <span>{day}</span>
                  <label className={k('sw')}>
                    <input
                      type="checkbox"
                      checked={on[i]}
                      aria-label={t('team.works', { day })}
                      onChange={(e) =>
                        setOn((xs) => xs.map((x, j) => (j === i ? e.target.checked : x)))
                      }
                    />
                    <span />
                  </label>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[0, 1].map((p) => (
                      <span key={p} style={{ display: 'contents' }}>
                        {p === 1 && ' – '}
                        <input
                          type="time"
                          step={900}
                          value={times[i]![p]}
                          disabled={!on[i]}
                          aria-label={p ? t('team.endOf', { day }) : t('team.startOf', { day })}
                          onChange={(e) =>
                            setTimes((xs) =>
                              xs.map((x, j) =>
                                j === i
                                  ? ((p ? [x[0], e.target.value] : [e.target.value, x[1]]) as [
                                      string,
                                      string,
                                    ])
                                  : x,
                              ),
                            )
                          }
                        />
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={k('err')}>{err.sh ?? ''}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className={k('btn btn-ghost')} onClick={() => ui.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={k('btn btn-primary')}>
            {t('team.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** `/provider/activity`: who did what in this shop (owners and managers). */
export function ActivityPage() {
  const d = useData();
  return <ActivityLog businessId={d.business.id} />;
}
