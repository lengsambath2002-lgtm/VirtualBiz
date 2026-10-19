'use client';

import { useTranslations } from 'next-intl';

import { CommandPalette, type PaletteCommand } from '@/features/command-palette';
import { PIcon, type PIconName } from '@/features/provider-shared/components/Icon';
import { formatPhone } from '@/lib/utils/phone';
import {
  calendarHref,
  pageHref,
  PROVIDER_PAGES,
} from '@/features/provider-shared/hooks/useActions';
import { useFmt } from '@/features/provider-shared/hooks/useFmt';
import { useData, useUi, type Overlay } from '@/features/provider-shared/store';
import { isActive } from '@/features/provider-shared/util/logic';
import { hm, todayIso } from '@/features/provider-shared/util/time';
import { useRouter } from '@/lib/i18n/navigation';

const PAGE_ICON: Record<(typeof PROVIDER_PAGES)[number], PIconName> = {
  home: 'home',
  calendar: 'cal',
  sales: 'sales',
  clients: 'users',
  services: 'scissors',
  team: 'team',
  marketing: 'megaphone',
  settings: 'gear',
};

/** Ctrl K: actions, clients, upcoming bookings and pages (prototype `palette()`). */
export function Palette() {
  const t = useTranslations('provider');
  const f = useFmt();
  const d = useData();
  const close = useUi((s) => s.close);
  const open = useUi((s) => s.open);
  const router = useRouter();
  const today = todayIso();
  const icon = (n: PIconName) => <PIcon name={n} size={18} />;
  const strip = (s: string) => s.replace(/\s/g, '');

  const actions: [string, Overlay][] = [
    [t('palette.newAppt'), { t: 'apptForm', opts: {} }],
    [t('palette.walkin'), { t: 'apptForm', opts: { walkin: true } }],
    [t('palette.quickSale'), { t: 'checkout' }],
    [t('palette.block'), { t: 'block' }],
  ];
  const commands: PaletteCommand[] = [
    ...actions.map(([label, ov], i) => ({
      id: `act-${i}`,
      group: t('palette.actions'),
      label,
      icon: icon('plus'),
      showWhenEmpty: true,
      run: () => open(ov),
    })),
    ...d.clients.map((c) => ({
      id: `c-${c.id}`,
      group: t('palette.clients'),
      label: c.name,
      sub: formatPhone(c.phone),
      icon: icon('users'),
      match: (q: string) => (c.name + c.phone).toLowerCase().includes(strip(q)),
      run: () => open({ t: 'client', id: c.id }),
    })),
    ...d.appointments
      .filter((a) => a.date >= today && isActive(a))
      .map((a) => {
        const c = d.clients.find((x) => x.id === a.clientId);
        const s = d.services.find((x) => x.id === a.serviceId);
        return {
          id: `a-${a.id}`,
          group: t('palette.upcoming'),
          label: `${c?.name ?? ''} · ${s?.name ?? ''}`,
          sub: `${f.rel(a.date, today)} ${hm(a.start)}`,
          icon: icon('cal'),
          match: (q: string) => ((c?.name ?? '') + a.number).toLowerCase().includes(q),
          run: () => {
            router.push(calendarHref({ date: a.date }));
            open({ t: 'appt', id: a.id });
          },
        };
      }),
    ...PROVIDER_PAGES.map((p) => ({
      id: `p-${p}`,
      group: t('palette.pages'),
      label: t(`nav.${p}`),
      icon: icon(PAGE_ICON[p]),
      showWhenEmpty: true,
      run: () => router.push(pageHref(p)),
    })),
  ];

  return (
    <CommandPalette
      open
      onClose={() => close(true)}
      commands={commands}
      groupLimits={{ [t('palette.clients')]: 5, [t('palette.upcoming')]: 4 }}
      placeholder={t('palette.placeholder')}
      ariaLabel={t('palette.label')}
      emptyLabel={t('palette.noMatches')}
    />
  );
}
