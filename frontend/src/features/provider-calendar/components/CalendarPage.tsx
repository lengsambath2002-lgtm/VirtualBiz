'use client';

import { useSearchParams } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from 'react';

import { useRouter } from '@/lib/i18n/navigation';

import { StaffAvatar, STATUS_CLASS, SourceIcon } from '@/features/provider-shared/components/Bits';
import { PIcon } from '@/features/provider-shared/components/Icon';
import { k } from '@/features/provider-shared/cx';
import { calendarHref, useActions } from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { deleteBlock, patchAppointment } from '@/features/provider-shared/api';
import { putAppointment, useData, useProviderStore, useUi } from '@/features/provider-shared/store';
import type {
  CalendarView,
  ProviderAppointment,
  ProviderData,
} from '@/features/provider-shared/types';
import {
  apptEnd,
  conflicts,
  firstName,
  isActive,
  isLocked,
  openHoursOn,
  pending,
  shiftOf,
} from '@/features/provider-shared/util/logic';
import {
  addDays,
  dow,
  fmtDayMonth,
  fmtDayMonthYear,
  fmtDL,
  fmtWeekday,
  H0,
  H1,
  hm,
  isIsoDate,
  nowMin,
  PXM,
  relKey,
  todayIso,
  topOf,
  weekStart,
} from '@/features/provider-shared/util/time';

const COL_H = (H1 - H0) * 48;

interface Drag {
  id: string;
  sx: number;
  sy: number;
  moved: boolean;
  start: number;
  /** Target column key `${staffId}|${date}` and its x offset from the origin column. */
  col: string;
  dx: number;
}

/** Calendar (prototype default page): staff columns × 15-min grid, or a 7-day week. */
export function CalendarPage() {
  const f = useFmt();
  const { t, locale } = f;
  const d = useData();
  const ui = useUi();
  const actions = useActions();
  const router = useRouter();
  const search = useSearchParams();
  const today = todayIso();

  const qd = search.get('date');
  const date = isIsoDate(qd) ? qd : today;
  const view: CalendarView = search.get('view') === 'week' ? 'week' : 'day';
  const qs = search.get('staff');
  const staffF = qs && d.staff.some((m) => m.id === qs) ? qs : 'all';
  // The latest requested params, updated synchronously on every nav so quick consecutive
  // actions (a click then a shortcut) build on each other instead of a stale URL.
  const qsNow = search.toString();
  const live = useRef({ qs: qsNow, date, view, staff: staffF });
  if (live.current.qs !== qsNow) live.current = { qs: qsNow, date, view, staff: staffF };
  const nav = (p: { date?: string; view?: CalendarView; staff?: string }) => {
    const next = { ...live.current, ...p };
    live.current = { ...next, qs: live.current.qs };
    router.push(calendarHref(next));
  };

  // Auto-refresh every 60 s (now line, "next up"), unless an overlay is open or a drag is on.
  const [, setTick] = useState(0);
  useEffect(() => {
    const h = setInterval(() => {
      const s = useUi.getState();
      if (!s.overlay && !s.dragging) setTick((x) => x + 1);
    }, 60_000);
    return () => clearInterval(h);
  }, []);

  // Keyboard: t = today, n = new, Alt+←/→ = previous / next day.
  const navRef = useRef(nav);
  navRef.current = nav;
  const liveRef = useRef(live);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().overlay) return;
      const el = e.target as HTMLElement;
      if (el.matches('input,select,textarea')) return;
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 't' && !e.altKey) navRef.current({ date: todayIso() });
      else if (e.key === 'n' && !e.altKey) useUi.getState().open({ t: 'apptForm', opts: {} });
      else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        navRef.current({
          date: addDays(liveRef.current.current.date, e.key === 'ArrowLeft' ? -1 : 1),
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Scroll today's day view to "now" (prototype: now − 120 px).
  const calRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cal = calRef.current;
    if (cal && date === today && view === 'day') cal.scrollTop = Math.max(0, topOf(nowMin()) - 120);
  }, [date, view, today]);

  const isDay = view === 'day';
  const cols = d.staff.filter((m) => m.active && (staffF === 'all' || staffF === m.id));
  const ws = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const rk = relKey(date, today);
  const label = isDay
    ? rk
      ? t('time.relDay', { rel: t(`time.${rk}`), date: fmtDL(date, locale) })
      : fmtDL(date, locale)
    : `${fmtDayMonth(ws, locale)} – ${fmtDayMonthYear(addDays(ws, 6), locale)}`;
  const closure = d.business.closures.find((c) => c.date === date);
  const dayAppts = d.appointments.filter((a) => a.date === date && isActive(a));
  const booked = dayAppts.filter((a) => a.status !== 'REQUESTED');
  const bookedMin = booked.reduce((x, a) => x + a.durationMin, 0);
  const cap = d.staff.reduce((x, m) => {
    const sh = shiftOf(d.business, m, date);
    return x + (sh ? sh[1] - sh[0] : 0);
  }, 0);
  const nReq = pending(d).length;

  // ---- Drag to move ----
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setD = (v: Drag | null) => {
    dragRef.current = v;
    setDrag(v);
  };

  const onEvDown = (
    e: RPointerEvent<HTMLButtonElement>,
    a: ProviderAppointment,
    colKey: string,
  ) => {
    if (e.button !== 0) return;
    const origin = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().left;
    const locked = isLocked(a.status);
    const st: Drag = {
      id: a.id,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      start: a.start,
      col: colKey,
      dx: 0,
    };
    dragRef.current = st;
    const mv = (ev: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const dy = ev.clientY - cur.sy;
      const dx = ev.clientX - cur.sx;
      if (!cur.moved && Math.hypot(dx, dy) < 5) return;
      if (locked) return;
      const start = Math.max(
        H0 * 60,
        Math.min(H1 * 60 - a.durationMin, a.start + Math.round(dy / 12) * 15),
      );
      const under = document
        .elementsFromPoint(ev.clientX, ev.clientY)
        .find((x) => x instanceof HTMLElement && x.dataset.colkey) as HTMLElement | undefined;
      const next: Drag = { ...cur, moved: true, start };
      if (under) {
        next.col = under.dataset.colkey!;
        next.dx = under.getBoundingClientRect().left - origin;
      }
      if (!cur.moved) useUi.getState().set({ dragging: true });
      setD(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const cur = dragRef.current;
      setD(null);
      useUi.getState().set({ dragging: false });
      if (!cur) return;
      if (!cur.moved) {
        actions.openAppt(a.id);
        return;
      }
      void drop(a.id, cur);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const drop = async (id: string, cur: Drag) => {
    const data = useProviderStore.getState().data as ProviderData;
    const a = data.appointments.find((x) => x.id === id)!;
    const [colStaff = '', colDate = a.date] = cur.col.split('|');
    const target = {
      ...a,
      start: cur.start,
      staffId: isDay && colStaff ? colStaff : a.staffId,
      date: colDate,
    };
    if (target.start === a.start && target.staffId === a.staffId && target.date === a.date) return;
    const svc = data.services.find((s) => s.id === a.serviceId);
    const tName = firstName(data.staff.find((m) => m.id === target.staffId)?.name ?? '');
    if (svc && !svc.staffIds.includes(target.staffId)) {
      ui.showToast(t('calendar.cantDo', { name: tName, service: svc.name }));
      return;
    }
    const c = conflicts(data, target);
    if (c.length) {
      const ok = await ui.confirm({
        title: t('calendar.moveTitle'),
        body: t('calendar.moveBody', { list: f.conflicts(c) }),
        ok: t('calendar.moveOk'),
      });
      if (!ok) return;
    }
    const prevStaff = a.staffId;
    // Show the move at once; the API's answer (with its log line) replaces it.
    useProviderStore.getState().update((dd) => {
      const x = dd.appointments.find((y) => y.id === id)!;
      Object.assign(x, { start: target.start, staffId: target.staffId, date: target.date });
    });
    try {
      putAppointment(
        await patchAppointment(data.business.id, id, {
          start: target.start,
          staffId: target.staffId,
          date: target.date,
        }),
      );
    } catch (e) {
      putAppointment(a);
      actions.fail(e);
      return;
    }
    ui.showToast(
      prevStaff !== target.staffId
        ? t('calendar.movedStaff', { time: hm(target.start), staff: tName })
        : t('calendar.moved', { time: hm(target.start) }),
      actions.undoOf(id),
    );
  };

  const staffOf = (id: string) => d.staff.find((m) => m.id === id);

  /** One column: off-shift shading, 15-min hit targets, blocks, events, now line. */
  const column = (stId: string | null, day: string, week: boolean, i: number) => {
    const staffs = stId ? [stId] : d.staff.map((m) => m.id);
    const sh = stId ? shiftOf(d.business, staffOf(stId), day) : openHoursOn(d.business, day);
    const colKey = `${stId ?? ''}|${day}`;
    const evs = d.appointments.filter(
      (a) =>
        a.date === day && staffs.includes(a.staffId) && (isActive(a) || a.status === 'NO_SHOW'),
    );
    const bls = d.blocks.filter((b) => b.date === day && staffs.includes(b.staffId));
    const nm = nowMin();
    return (
      <div key={colKey + i} className={k('col')} data-colkey={colKey} style={{ height: COL_H }}>
        {!sh ? (
          <div className={k('off')} style={{ top: 0, height: COL_H }} />
        ) : (
          <>
            <div className={k('off')} style={{ top: 0, height: topOf(sh[0]) }} />
            <div className={k('off')} style={{ top: topOf(sh[1]), bottom: 0 }} />
          </>
        )}
        {sh &&
          Array.from({ length: (sh[1] - sh[0]) / 15 }, (_, j) => {
            const m = sh[0] + j * 15;
            return (
              <button
                key={m}
                type="button"
                className={k('hit')}
                style={{ top: topOf(m) }}
                tabIndex={-1}
                aria-label={t('calendar.newAt', { time: hm(m) })}
                onClick={() =>
                  stId
                    ? ui.open({ t: 'slot', staffId: stId, date: day, start: m })
                    : ui.open({ t: 'apptForm', opts: { date: day, start: m } })
                }
              />
            );
          })}
        {bls.map((b) => {
          const m = staffOf(b.staffId);
          return (
            <button
              key={b.id}
              type="button"
              className={k('blk')}
              style={{ top: topOf(b.start), height: b.durationMin * PXM - 2 }}
              onClick={async () => {
                const reason = t(`blockReason.${b.reason}`);
                const ok = await ui.confirm({
                  title: t('calendar.blockTitle'),
                  body: `${reason} · ${m?.name ?? ''} · ${hm(b.start)}–${hm(b.start + b.durationMin)}`,
                  ok: t('calendar.blockOk'),
                  danger: true,
                });
                if (ok) {
                  try {
                    await deleteBlock(d.business.id, b.id);
                  } catch (e) {
                    actions.fail(e);
                    return;
                  }
                  useProviderStore.getState().update((dd) => {
                    dd.blocks = dd.blocks.filter((x) => x.id !== b.id);
                  });
                  ui.showToast(t('calendar.unblocked'));
                }
              }}
            >
              <strong style={{ fontWeight: 500 }}>{t(`blockReason.${b.reason}`)}</strong>
              {week ? ` · ${firstName(m?.name ?? '')}` : ''}
            </button>
          );
        })}
        {evs.map((a) => {
          const c = d.clients.find((x) => x.id === a.clientId);
          const s = d.services.find((x) => x.id === a.serviceId);
          const st = staffOf(a.staffId);
          const h = Math.max(22, a.durationMin * PXM - 2);
          const dg = drag && drag.id === a.id && drag.moved ? drag : null;
          const top = topOf(dg ? dg.start : a.start);
          const tipStaff = dg && isDay ? dg.col.split('|')[0] : '';
          const style = {
            '--c': st?.color,
            top,
            height: h,
            ...(dg ? { transform: `translateX(${dg.dx}px)` } : {}),
          } as CSSProperties;
          return (
            <button
              key={a.id}
              type="button"
              className={k('ev', STATUS_CLASS[a.status], dg && 'dragging')}
              style={style}
              aria-label={`${c?.name ?? ''}, ${s?.name ?? ''}, ${hm(a.start)}, ${f.status(a.status)}`}
              onPointerDown={(e) => onEvDown(e, a, colKey)}
              onClick={(e) => {
                if (e.detail === 0) actions.openAppt(a.id);
              }}
            >
              <span className={k('tm')}>
                {hm(a.start)}–{hm(apptEnd(a))}
              </span>
              <strong>{c?.name}</strong>
              {h > 40 && (
                <span
                  style={{
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s?.name}
                  {week ? ` · ${firstName(st?.name ?? '')}` : ''}
                </span>
              )}
              <span className={k('ic')}>
                {a.status === 'REQUESTED' && (
                  <span className={k('pill warn')} style={{ padding: '0 6px', fontSize: 10 }}>
                    {t('calendar.requestPill')}
                  </span>
                )}
                {a.note ? <PIcon name="note" size={12} /> : null}
                <SourceIcon source={a.source} />
              </span>
              {dg && (
                <span className={k('ghost-time')}>
                  {hm(dg.start)}
                  {tipStaff ? ` · ${firstName(staffOf(tipStaff)?.name ?? '')}` : ''}
                </span>
              )}
            </button>
          );
        })}
        {day === today && nm > H0 * 60 && nm < H1 * 60 && (
          <div className={k('now')} style={{ top: topOf(nm) }} />
        )}
      </div>
    );
  };

  const times = (
    <div className={k('times')}>
      {Array.from({ length: H1 - H0 }, (_, i) => (
        <div key={i}>{i ? hm((H0 + i) * 60) : ''}</div>
      ))}
    </div>
  );

  return (
    <>
      <div className={k('cal-bar')}>
        <button
          type="button"
          className={k('btn btn-ghost btn-sm')}
          onClick={() => nav({ date: today })}
        >
          {t('calendar.today')}
        </button>
        <button
          type="button"
          className={k('ibtn')}
          aria-label={t('calendar.prev')}
          onClick={() =>
            nav({ date: addDays(live.current.date, live.current.view === 'day' ? -1 : -7) })
          }
        >
          <PIcon name="left" />
        </button>
        <button
          type="button"
          className={k('ibtn')}
          aria-label={t('calendar.next')}
          onClick={() =>
            nav({ date: addDays(live.current.date, live.current.view === 'day' ? 1 : 7) })
          }
        >
          <PIcon name="right" />
        </button>
        <h1 className={k('num')}>{label}</h1>
        <input
          type="date"
          aria-label={t('calendar.jump')}
          className={k('select')}
          style={{ width: 150 }}
          value={date}
          onChange={(e) => {
            if (isIsoDate(e.target.value)) nav({ date: e.target.value });
          }}
        />
        <div className={k('r')}>
          {nReq > 0 && (
            <button
              type="button"
              className={k('btn btn-ghost btn-sm reqbtn')}
              onClick={() => ui.open({ t: 'requests' })}
            >
              <PIcon name="inbox" size={16} />
              {t('calendar.requests', { count: nReq })}
            </button>
          )}
          <select
            className={k('select')}
            aria-label={t('calendar.teamMember')}
            value={staffF}
            onChange={(e) => nav({ staff: e.target.value })}
          >
            <option value="all">{t('calendar.allTeam')}</option>
            {d.staff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className={k('seg')} role="tablist">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={k(view === v && 'on')}
                onClick={() => nav({ view: v })}
              >
                {t(`calendar.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {isDay && (
        <div className={k('meta')} style={{ fontSize: 12.5 }}>
          {closure && (
            <span className={k('pill bad')}>
              {t('calendar.closedPill', { reason: closure.reason })}
            </span>
          )}
          <span>{t.rich('calendar.metaAppointments', { n: booked.length, b: bold })}</span>·
          <span>
            {t.rich('calendar.metaBooked', {
              pct: cap ? Math.round((bookedMin / cap) * 100) : 0,
              b: bold,
            })}
          </span>
          ·
          <span>
            {t.rich('calendar.metaExpected', {
              amount: f.money0(booked.reduce((x, a) => x + a.price, 0)),
              b: bold,
            })}
          </span>
          ·<span className={k('muted')}>{t('calendar.hint')}</span>
        </div>
      )}
      <div className={k('cal')} ref={calRef}>
        {isDay ? (
          <div
            className={k('cg')}
            style={{ gridTemplateColumns: `56px repeat(${cols.length},minmax(190px,1fr))` }}
          >
            <div className={k('ch corner')} />
            {cols.map((m) => {
              const sh = shiftOf(d.business, m, date);
              const n = dayAppts.filter(
                (a) => a.staffId === m.id && a.status !== 'REQUESTED',
              ).length;
              return (
                <div key={m.id} className={k('ch')}>
                  <StaffAvatar m={m} />
                  <div style={{ minWidth: 0 }}>
                    <strong>{m.name}</strong>
                    <span>
                      {sh
                        ? t('calendar.shiftInfo', { from: sh[0] / 60, to: sh[1] / 60, n })
                        : t('calendar.notWorking')}
                    </span>
                  </div>
                </div>
              );
            })}
            {times}
            {cols.map((m, i) => column(m.id, date, false, i))}
          </div>
        ) : (
          <div
            className={k('cg')}
            style={{ gridTemplateColumns: '56px repeat(7,minmax(130px,1fr))' }}
          >
            <div className={k('ch corner')} />
            {days.map((x) => {
              const c = d.business.closures.find((y) => y.date === x);
              const n = d.appointments.filter(
                (a) =>
                  a.date === x &&
                  isActive(a) &&
                  a.status !== 'REQUESTED' &&
                  (staffF === 'all' || a.staffId === staffF),
              ).length;
              return (
                <button
                  key={x}
                  type="button"
                  className={k('ch day', x === today && 'today')}
                  onClick={() => nav({ date: x, view: 'day' })}
                >
                  <span>{fmtWeekday(x, locale)}</span>
                  <b className={k('num')}>{Number(x.slice(8))}</b>
                  <span>
                    {c ? (
                      <span style={{ color: 'var(--danger)' }}>{c.reason}</span>
                    ) : !d.business.hours[dow(x)] ? (
                      t('calendar.closed')
                    ) : (
                      t('calendar.nBooked', { n })
                    )}
                  </span>
                </button>
              );
            })}
            {times}
            {days.map((x, i) => column(staffF === 'all' ? null : staffF, x, true, i))}
          </div>
        )}
      </div>
    </>
  );
}

const bold = (chunks: React.ReactNode) => (
  <b className={k('num')} style={{ color: 'var(--ink)' }}>
    {chunks}
  </b>
);
