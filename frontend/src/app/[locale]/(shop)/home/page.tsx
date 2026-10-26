import type { HomeBanners } from '@/features/shop-home';
import { HomePage } from '@/features/shop-home/components/HomePage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';
import { serverGet } from '@/lib/api/server';

export const generateMetadata = shopMetadata('home');

export default async function Page() {
  // The banners a super-admin keeps in the console, in the first render (no flash of old ones).
  const banners = await serverGet<HomeBanners>('/meta/home-banners', 60);
  return <HomePage banners={banners} />;
}
