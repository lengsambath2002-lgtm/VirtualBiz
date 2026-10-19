'use client';

import type { AppointmentSource, AppointmentStatus, BusinessMember, Client } from '@/lib/domain';

import { k } from '../cx';
import { useFmt } from '../hooks/useFmt';
import { initials } from '../util/logic';
import { PIcon } from './Icon';

const STATUS_TONE: Record<AppointmentStatus, string> = {
  REQUESTED: 'warn',
  BOOKED: 'info',
  CONFIRMED: 'info',
  ARRIVED: 'dark',
  STARTED: 'ok',
  COMPLETED: 'ok',
  NO_SHOW: 'bad',
  CANCELLED: 'neutral',
  DECLINED: 'neutral',
};

/** CSS class the prototype gives an event of this status. */
export const STATUS_CLASS: Record<AppointmentStatus, string> = {
  REQUESTED: 'requested',
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  ARRIVED: 'arrived',
  STARTED: 'started',
  COMPLETED: 'completed',
  NO_SHOW: 'noshow',
  CANCELLED: 'cancelled',
  DECLINED: 'declined',
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  const f = useFmt();
  return <span className={k('pill', STATUS_TONE[status])}>{f.status(status)}</span>;
}

export function StaffAvatar({
  m,
  size = 32,
}: {
  m: Pick<BusinessMember, 'name' | 'color'>;
  size?: number;
}) {
  return (
    <span className={k('av')} style={{ background: m.color, width: size, height: size }}>
      {initials(m.name)}
    </span>
  );
}

export function ClientAvatar({ c, size = 36 }: { c: Pick<Client, 'name'>; size?: number }) {
  return (
    <span className={k('av avc')} style={{ width: size, height: size }}>
      {initials(c.name)}
    </span>
  );
}

export function Stars({ n }: { n: number }) {
  const f = useFmt();
  return (
    <span className={k('star')} role="img" aria-label={f.t('marketing.stars', { n })}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= n ? (
          <PIcon key={i} name="star" size={13} fill="currentColor" />
        ) : (
          <PIcon key={i} name="star" size={13} style={{ opacity: 0.3 }} />
        ),
      )}
    </span>
  );
}

export function SourceIcon({ source }: { source: AppointmentSource }) {
  return (
    <PIcon
      name={source === 'ONLINE' ? 'globe' : source === 'WALK_IN' ? 'walk' : 'phone'}
      size={12}
    />
  );
}
