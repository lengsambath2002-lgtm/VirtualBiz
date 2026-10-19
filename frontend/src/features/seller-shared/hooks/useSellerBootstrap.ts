'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { useWorkspaceBusiness } from '@/features/account-switcher';
import { fallbackErrorKey, isApiError, metaNumber } from '@/lib/api';
import { useSession } from '@/lib/auth';
import type { Business } from '@/lib/domain';
import { DEFAULT_ZONES } from '@/lib/pricing';
import { workspaceKey } from '@/lib/workspace';

import {
  fetchSellerCatalog,
  fetchSellerExtras,
  fetchSellerOrders,
  type SellerExtras,
} from '../api';
import {
  setStockErrorHandler,
  useSellerStore,
  type SellerCatalog,
  type SellerOrdersSync,
} from '../store/sellerStore';
import { useUi } from '../store/uiStore';
import type { SellerDb } from '../types';

/** The workspace's shop header and settings from the API business. */
function shopFromBusiness(b: Business, ownerName: string): SellerDb['shop'] {
  const ps = b.type === 'PRODUCT' ? b.productSettings : undefined;
  return {
    id: b.id,
    name: b.name,
    ownerId: b.ownerId,
    ownerName,
    about: b.about ?? '',
    phone: b.phone,
    addr: `${b.street}, ${b.district}, Phnom Penh`,
    online: b.online,
    bakongId: b.bakongId ?? '',
    logoUrl: b.logoUrl ?? '',
    coverUrl: b.coverUrl ?? '',
    autoAccept: ps?.autoAccept ?? false,
    prepMinutes: ps?.prepMinutes ?? 20,
    lowStockDefault: ps?.lowStockDefault ?? 5,
    pickup: ps?.pickup ?? true,
    cod: ps?.cod ?? true,
    freeDeliveryOver: ps?.freeDeliveryOver ?? 0,
    zones: ps?.zones?.length ? ps.zones : DEFAULT_ZONES,
  };
}

/** The workspace to start from: everything from the API. */
function seedFrom(
  b: Business,
  ownerName: string,
  catalog: SellerCatalog,
  orders: SellerOrdersSync,
  extras: SellerExtras,
): SellerDb {
  return {
    shop: shopFromBusiness(b, ownerName),
    products: catalog.products,
    orders: orders.orders,
    log: catalog.log,
    promos: extras.promos,
    reviews: extras.reviews,
    customers: extras.customers,
    notifs: orders.notifs,
    pos: {
      cart: [],
      disc: null,
      cust: '',
      held: [],
      shift: extras.shift,
      shifts: extras.shifts,
      sales: extras.sales,
      pending: [],
    },
    collections: catalog.collections,
  };
}

/** Business whose data the store holds right now (survives client navigation). */
let loadedFor: string | null = null;

/** Toasts for stock changes the API refused (the state was reloaded from it). */
function useStockErrors() {
  const t = useTranslations('seller.inventory');
  const tc = useTranslations('common');
  useEffect(() => {
    setStockErrorHandler((e) => {
      const msg = isApiError(e, 'INSUFFICIENT_STOCK')
        ? t('notEnough', { n: metaNumber(e, 'stock', 0) })
        : isApiError(e)
          ? t('syncFailed')
          : tc(fallbackErrorKey(e));
      useUi.getState().showToast(msg);
    });
    return () => setStockErrorHandler(null);
  }, [t, tc]);
}

/**
 * Point the persisted seller store at the open business (from the API; each business keeps
 * its own saved workspace), rehydrate it, seed it the first time, and load the catalogue
 * (products, collections, stock log) from the API every time the workspace opens.
 * `ready` turns true once both are there (client only, so times stay local).
 */
export function useSellerBootstrap() {
  const db = useSellerStore((s) => s.db);
  const seed = useSellerStore((s) => s.seed);
  const { user } = useSession();
  const { business, error } = useWorkspaceBusiness('PRODUCT');
  const [target, setTarget] = useState<string | null>(null);
  const [synced, setSynced] = useState<unknown>(null);
  const [ordersSynced, setOrdersSynced] = useState<unknown>(null);
  const [extrasSynced, setExtrasSynced] = useState<unknown>(null);
  const id = business?.id ?? null;
  useStockErrors();

  useEffect(() => {
    if (!id) return;
    const persist = useSellerStore.persist;
    if (loadedFor === id && persist.hasHydrated()) {
      setTarget(id);
      return;
    }
    const name = workspaceKey('vb-seller', id);
    persist.setOptions({ name });
    let stored = false;
    try {
      stored = localStorage.getItem(name) !== null;
    } catch {
      /* blocked storage: seed in memory */
    }
    if (!stored) {
      useSellerStore.setState({ db: null });
      loadedFor = id;
      setTarget(id);
      return;
    }
    void Promise.resolve(persist.rehydrate()).then(() => {
      loadedFor = id;
      setTarget(id);
    });
  }, [id]);

  const catalog = useQuery({
    queryKey: ['seller', 'catalog', target],
    queryFn: () => fetchSellerCatalog(target!),
    enabled: !!target,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // Orders and the inbox: live events keep them current after this (SellerShell).
  const orders = useQuery({
    queryKey: ['seller', 'orders', target],
    queryFn: () => fetchSellerOrders(target!),
    enabled: !!target,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  // The register, promotions, customers and reviews.
  const extras = useQuery({
    queryKey: ['seller', 'extras', target],
    queryFn: () => fetchSellerExtras(target!),
    enabled: !!target,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (target && !db && business && catalog.data && orders.data && extras.data) {
      seed(seedFrom(business, user?.name ?? '', catalog.data, orders.data, extras.data));
      setSynced(catalog.data);
      setOrdersSynced(orders.data);
      setExtrasSynced(extras.data);
    }
  }, [target, db, business, user, seed, catalog.data, orders.data, extras.data]);

  // A saved workspace takes the API's catalogue, orders and inbox each time it opens.
  useEffect(() => {
    if (db && catalog.data && db.shop.id === target && synced !== catalog.data) {
      useSellerStore.getState().syncCatalog(catalog.data);
      setSynced(catalog.data);
    }
  }, [db, catalog.data, target, synced]);
  useEffect(() => {
    if (db && orders.data && db.shop.id === target && ordersSynced !== orders.data) {
      useSellerStore.getState().syncOrders(orders.data);
      setOrdersSynced(orders.data);
    }
  }, [db, orders.data, target, ordersSynced]);
  useEffect(() => {
    if (db && extras.data && db.shop.id === target && extrasSynced !== extras.data) {
      useSellerStore.getState().syncExtras(extras.data);
      setExtrasSynced(extras.data);
    }
  }, [db, extras.data, target, extrasSynced]);

  // The API owns the business name: keep a saved workspace in step with it.
  const updateShop = useSellerStore((s) => s.updateShop);
  useEffect(() => {
    if (business && db && db.shop.id === business.id && db.shop.name !== business.name)
      updateShop({ name: business.name });
  }, [business, db, updateShop]);

  return {
    ready:
      !!target && !!db && db.shop.id === target && !!synced && !!ordersSynced && !!extrasSynced,
    error: error ?? catalog.error ?? orders.error ?? extras.error,
  };
}
