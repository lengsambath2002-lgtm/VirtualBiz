import { ProductEditor } from '@/features/seller-products';

export default async function SellerProductRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditor key={id} id={decodeURIComponent(id)} />;
}
