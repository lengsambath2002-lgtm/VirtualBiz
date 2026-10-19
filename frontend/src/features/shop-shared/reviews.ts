'use client';

import { useQuery } from '@tanstack/react-query';

import { api, type ApiMyReview } from '@/lib/api';
import { useSession } from '@/lib/auth';

// The reviews the signed-in customer wrote (docs/api/phase5-pos-promotions-reviews.md § Reviews).

export const myReviewsKey = (userId: string | undefined) => ['me', userId, 'reviews'] as const;

export function useMyReviews() {
  const { user } = useSession();
  return useQuery({
    queryKey: myReviewsKey(user?.id),
    queryFn: () => api.get<ApiMyReview[]>('/me/reviews'),
    enabled: !!user,
    staleTime: 60_000,
  });
}
