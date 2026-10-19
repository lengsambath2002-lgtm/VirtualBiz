import { notFound } from 'next/navigation';

/** Any provider workspace address no page claims: the provider workspace's own 404 (inside its frame). */
export default function ProviderCatchAll() {
  notFound();
}
