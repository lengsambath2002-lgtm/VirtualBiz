import { notFound } from 'next/navigation';

/** Any marketplace address no page claims: the marketplace's own 404 (inside its frame). */
export default function ShopCatchAll() {
  notFound();
}
