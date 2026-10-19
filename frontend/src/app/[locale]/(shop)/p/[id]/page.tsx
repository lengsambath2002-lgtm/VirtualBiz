import { ProductPage } from '@/features/shop-product/components/ProductPage';
import { shopMetadata } from '@/features/shop-layout/util/metadata';

export const generateMetadata = shopMetadata('product');

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductPage id={decodeURIComponent(id)} />;
}
