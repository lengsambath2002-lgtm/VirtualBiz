'use client';

import { useQuery } from '@tanstack/react-query';

import { signInMethods } from '../api';

/**
 * Ways in the server can actually deliver (`GET /api/auth/methods`). Phone stays hidden until the
 * server says it can send texts, so nobody waits for a code that never comes.
 */
export function useSignInMethods() {
  const q = useQuery({
    queryKey: ['auth', 'methods'],
    queryFn: signInMethods,
    staleTime: 5 * 60_000,
  });
  return { phone: q.data?.phone === true };
}
