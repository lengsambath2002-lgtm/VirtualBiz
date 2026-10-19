import { notFound } from 'next/navigation';

import { AccountPage } from '@/features/shop-account/components/AccountPage';
import { ACCOUNT_TABS, type AccountTab } from '@/features/shop-account/types';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('account');

export default async function Page({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!(ACCOUNT_TABS as readonly string[]).includes(tab)) notFound();
  return <AccountPage tab={tab as AccountTab} />;
}
