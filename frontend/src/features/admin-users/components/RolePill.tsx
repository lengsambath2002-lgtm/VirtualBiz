'use client';

import { useTranslations } from 'next-intl';

import { Pill } from '@/features/admin-shared/components/ui';
import type { PlatformRole } from '@/features/admin-shared/types';

export function RolePill({ role }: { role: PlatformRole }) {
  const t = useTranslations('admin.users.role');
  return <Pill tone="info">{t(role)}</Pill>;
}
