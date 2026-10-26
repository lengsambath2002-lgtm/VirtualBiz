import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export type LegalPageKey = 'terms' | 'privacy';

/** A legal page in both languages (`GET /api/meta/legal/{page}`, docs/api/site-content.md). */
export interface LegalDoc {
  en: string;
  kh: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const legalKey = (page: LegalPageKey) => ['legal', page] as const;

export const useLegal = (page: LegalPageKey) =>
  useQuery({
    queryKey: legalKey(page),
    queryFn: () => apiFetch<LegalDoc>(`/meta/legal/${page}`, { auth: false }),
    staleTime: 5 * 60_000,
  });
