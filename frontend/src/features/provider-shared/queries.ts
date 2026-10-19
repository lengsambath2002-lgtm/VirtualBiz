'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useWorkspaceBusiness } from '@/features/account-switcher';
import { api, type ApiBlock, type ApiClient, type ApiNotification, type ApiSale } from '@/lib/api';
import { useLiveStream } from '@/lib/api/useLiveStream';

import { fetchAppointment, fetchWorkspace, toBlock, toClient, toNotification, toSale } from './api';
import { putAppointment, useProviderStore } from './store';

export const providerWorkspaceKey = (businessId: string | undefined) =>
  ['provider', 'workspace', businessId] as const;

/** Re-reads one part of the workspace after a live event (another member, a customer, …). */
async function refreshPart(
  businessId: string,
  name: string,
  data: Record<string, string | undefined>,
) {
  const o = { businessId };
  const store = useProviderStore.getState();
  switch (name) {
    case 'appointment':
      if (data.id) putAppointment(await fetchAppointment(businessId, data.id));
      // A new online booking may be from a client the workspace has not seen yet.
      if (data.id && !store.data?.appointments.some((a) => a.id === data.id))
        await refreshClients(businessId);
      return;
    case 'notification': {
      const inbox = await api.get<ApiNotification[]>('/notifications', o);
      store.update((d) => {
        d.notifications = inbox.map(toNotification);
      });
      return;
    }
    case 'sale': {
      const sales = await api.get<ApiSale[]>('/sales', o);
      store.update((d) => {
        d.sales = sales.map(toSale).reverse();
      });
      return;
    }
    case 'block': {
      const blocks = await api.get<ApiBlock[]>('/blocks', o);
      store.update((d) => {
        d.blocks = blocks.map(toBlock);
      });
      return;
    }
  }
}

async function refreshClients(businessId: string) {
  const clients = await api.get<ApiClient[]>('/clients', { businessId });
  useProviderStore.getState().update((d) => {
    d.clients = clients.map(toClient);
  });
}

/**
 * Loads the open service business's workspace from the API each time the workspace opens and
 * keeps it current with the shop's live stream. `ready` once the data is there.
 */
export function useProviderData(): { ready: boolean; error: unknown; refetch: () => void } {
  const { business, error } = useWorkspaceBusiness('SERVICE');
  const id = business?.id;
  const q = useQuery({
    queryKey: providerWorkspaceKey(id),
    queryFn: () => fetchWorkspace(business!),
    enabled: !!business,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (q.data) useProviderStore.getState().set(q.data);
  }, [q.data]);

  useLiveStream('business', {
    enabled: !!id && !!q.data,
    ...(id ? { businessId: id } : {}),
    onEvent: (e) => {
      if (!id) return;
      if (e.name === 'open') {
        // (Re)connected: something may have changed while the stream was down.
        if (useProviderStore.getState().data) void q.refetch();
        return;
      }
      void refreshPart(id, e.name, e.data as Record<string, string | undefined>).catch(() => {
        /* the next event or a reload brings it back in step */
      });
    },
  });

  const data = useProviderStore((s) => s.data);
  return {
    ready: !!data && data.business.id === id,
    error: error ?? q.error,
    refetch: () => void q.refetch(),
  };
}
