'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { setKhrRate } from '@/lib/money';

export function Providers({
  children,
  khrPerUsd,
}: {
  children: ReactNode;
  /** The platform's riel rate (`GET /api/meta/settings`), set before any price renders. */
  khrPerUsd?: number | null;
}) {
  setKhrRate(khrPerUsd);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
