import { notFound } from 'next/navigation';

/** Any seller workspace address no page claims: the seller workspace's own 404 (inside its frame). */
export default function SellerCatchAll() {
  notFound();
}
