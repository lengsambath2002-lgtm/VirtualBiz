// Live updates over Server-Sent Events (docs/api/phase3-orders-checkout.md § Live updates).
// EventSource cannot send the Authorization header and the access token must never sit in a
// URL, so each connection first trades the bearer token for a single-use 60-second ticket.
import { api, API_BASE } from './client';

export type StreamScope = 'me' | 'business';
export type StreamEventName =
  | 'order'
  | 'payment'
  | 'notification'
  | 'appointment'
  | 'sale'
  | 'block'
  | 'shift';

/** `open` fires on every (re)connect: refetch what may have changed while disconnected. */
export interface StreamEvent {
  name: StreamEventName | 'open';
  data: Record<string, string>;
}

export interface StreamOptions {
  /** The shop whose stream to open (`business` scope; sent as X-Business-Id for the ticket). */
  businessId?: string;
  onEvent: (e: StreamEvent) => void;
}

const EVENTS: StreamEventName[] = [
  'order',
  'payment',
  'notification',
  'appointment',
  'sale',
  'block',
  'shift',
];
const MAX_BACKOFF_MS = 30_000;

/**
 * Opens the stream and keeps it open: on an error or when the server ends it (every 30 min)
 * it fetches a new ticket and reconnects, backing off 1 s, 2 s, 4 s… up to 30 s. Returns the
 * function that closes it for good.
 */
export function openStream(scope: StreamScope, opts: StreamOptions): () => void {
  let source: EventSource | null = null;
  let closed = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const retry = () => {
    if (closed) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(() => void connect(), delay);
  };

  const connect = async () => {
    if (closed) return;
    let ticket: string;
    try {
      ticket = (
        await api.post<{ ticket: string }>(
          '/stream/ticket',
          undefined,
          opts.businessId ? { businessId: opts.businessId } : undefined,
        )
      ).ticket;
    } catch {
      retry();
      return;
    }
    if (closed) return;
    const es = new EventSource(`${API_BASE}/stream/${scope}?ticket=${encodeURIComponent(ticket)}`);
    source = es;
    es.addEventListener('ready', () => {
      attempt = 0;
      opts.onEvent({ name: 'open', data: {} });
    });
    for (const name of EVENTS)
      es.addEventListener(name, (m) => {
        let data: Record<string, string> = {};
        try {
          data = JSON.parse((m as MessageEvent<string>).data) as Record<string, string>;
        } catch {
          /* keep {} */
        }
        opts.onEvent({ name, data });
      });
    es.onerror = () => {
      es.close();
      if (source === es) source = null;
      retry();
    };
  };

  void connect();
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    source?.close();
    source = null;
  };
}
