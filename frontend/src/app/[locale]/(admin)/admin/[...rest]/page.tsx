import { notFound } from 'next/navigation';

/** Any admin console address no page claims: the admin console's own 404 (inside its frame). */
export default function AdminCatchAll() {
  notFound();
}
