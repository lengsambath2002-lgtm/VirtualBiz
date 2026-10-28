'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { NotFoundView } from '@/components/feedback';

import { isUuid } from '../util/start';
import { Redirecting } from './Redirecting';

/**
 * `/platform/open?business={id}`: the platform's "Open shop". Signs in through the platform, then
 * the callback makes the shop the active business and opens its dashboard.
 */
export function PlatformOpen() {
  const t = useTranslations('platform.open');
  const business = useSearchParams().get('business');
  if (!isUuid(business)) return <NotFoundView title={t('missingTitle')} body={t('missingBody')} />;
  return <Redirecting input={{ intent: 'open', businessId: business }} />;
}
