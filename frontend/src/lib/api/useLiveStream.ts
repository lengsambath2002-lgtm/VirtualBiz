'use client';

import { useEffect, useRef } from 'react';

import { openStream, type StreamEvent, type StreamScope } from './stream';

/**
 * Keeps a live stream open while `enabled` (signed in, and for `business` a shop is open) and
 * hands every event to `onEvent` (the latest callback, without reconnecting when it changes).
 */
export function useLiveStream(
  scope: StreamScope,
  opts: { enabled: boolean; businessId?: string; onEvent: (e: StreamEvent) => void },
) {
  const handler = useRef(opts.onEvent);
  handler.current = opts.onEvent;
  const { enabled, businessId } = opts;
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    if (scope === 'business' && !businessId) return;
    return openStream(scope, {
      ...(businessId ? { businessId } : {}),
      onEvent: (e) => handler.current(e),
    });
  }, [scope, enabled, businessId]);
}
