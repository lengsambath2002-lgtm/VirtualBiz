'use client';

// Seller workspace state. Products, collections and the stock log (`syncCatalog`), the orders
// and shop inbox (`syncOrders`) and the register, promotions, customers and reviews
// (`syncExtras`) come from the API, refreshed each time the workspace opens and on live events,
// and are written through it. The register's cart, held sales and sales rung up offline are
// kept in localStorage; a sale is recorded locally at once and sent to the API (`clientRef`
// makes a retry safe). Inventory stock changes go through `writeStock`; orders and the register
// change stock on the server (inventory StockWriter).
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { isApiError, type ProductInput } from '@/lib/api';
import type { PaymentMethod, Promotion, StockReason } from '@/lib/domain';
import { round2 } from '@/lib/money';

import {
  createProduct,
  patchBusinessApi,
  shopPatch,
  endPromotion,
  fetchSellerExtras,
  posApi,
  replyReviewApi,
  savePromotion,
  setPromotionEnd,
  type SellerExtras,
  deleteProduct as deleteProductApi,
  duplicateProduct as duplicateProductApi,
  fetchSellerCatalog,
  fetchSellerOrders,
  orderApi,
  postMovement,
  readAllNotificationsApi,
  readNotificationApi,
  replaceProduct,
  revertMovementApi,
  setProductStatus,
} from '../api';

import type {
  CartLine,
  PosDiscount,
  SellerDb,
  SellerNotification,
  SellerOrder,
  SellerPosSale,
  SellerProduct,
} from '../types';
import { findVariant, posTotals, shiftCash, shiftFloat, vname } from '../util/derive';
import {
  clearPending,
  hasPending,
  isTmp,
  pendingDelta,
  reconcileWrite,
  revertStock,
  takePending,
  writeStock,
} from './stock';

/** A UUID for a sale the register rings up (the API keeps it as `clientRef`). */
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      );

/** Shown when the API refused a stock change or a sync failed (set by the workspace shell). */
let onStockError: ((e: unknown) => void) | null = null;
export function setStockErrorHandler(fn: ((e: unknown) => void) | null) {
  onStockError = fn;
}

/** The catalogue as the API returns it (`fetchSellerCatalog`). */
export interface SellerCatalog {
  products: SellerProduct[];
  log: SellerDb['log'];
  collections: string[];
}

/** Draft → `ProductInput` for POST / PUT `/api/catalog/products`. */
export function toProductInput(d: ProductDraft): ProductInput {
  return {
    title: d.title.trim(),
    description: d.description,
    ...(d.collection ? { collection: d.collection } : {}),
    status: d.status,
    lowStockAt: d.lowStockAt,
    options: d.options.map((o) => ({ name: o.name, values: o.values })),
    variants: d.variants.map((v) => ({
      id: v.id,
      options: v.options,
      price: round2(+v.price),
      ...(v.compareAt && +v.compareAt ? { compareAt: round2(+v.compareAt) } : {}),
      ...(v.cost && +v.cost ? { cost: round2(+v.cost) } : {}),
      sku: v.sku,
      barcode: v.barcode,
      stock: v.stock,
    })),
    photos: d.photos,
  };
}

/** The orders and inbox as the API returns them (`fetchSellerOrders`). */
export interface SellerOrdersSync {
  orders: SellerOrder[];
  notifs: SellerNotification[];
}

export type RejectReason = 'outOfStock' | 'cantDeliver' | 'listingError' | 'closingEarly';
export type FailReason = 'noAnswer' | 'wrongAddress' | 'refused';
export type ReturnReason = 'damaged' | 'wrongItem' | 'changedMind';

/** Editable product in the full-page editor (prices are strings while typing). */
export interface DraftVariant {
  id: string;
  options: Record<string, string>;
  price: string;
  compareAt: string;
  cost: string;
  sku: string;
  barcode: string;
  stock: number;
}
export interface ProductDraft {
  id: string | null;
  title: string;
  collection: SellerProduct['collection'];
  status: SellerProduct['status'];
  description: string;
  lowStockAt: number;
  options: { name: string; values: string[] }[];
  variants: DraftVariant[];
  photos: string[];
  sold: number;
  rating: number;
}

export interface CashTenderInfo {
  usd: number;
  khr: number;
  change: number;
}

interface SellerState {
  db: SellerDb | null;
  seed: (db: SellerDb) => void;
  reset: () => void;
  // orders (API): each resolves once the server answered; failures reject with the ApiError
  /** Replace the orders and the shop inbox with the API's. */
  syncOrders: (o: SellerOrdersSync) => void;
  /** Reload the orders and the inbox from the API. */
  resyncOrders: () => Promise<void>;
  acceptOrders: (ids: string[]) => Promise<SellerOrder[]>;
  undoAccept: (ids: string[]) => Promise<void>;
  rejectOrder: (id: string, reason: RejectReason, markSoldOut: boolean) => Promise<SellerOrder>;
  packOrder: (id: string) => Promise<SellerOrder>;
  shipOrder: (id: string, own: boolean) => Promise<SellerOrder>;
  pickupOrder: (id: string) => Promise<SellerOrder>;
  deliverOrder: (id: string) => Promise<SellerOrder>;
  failDelivery: (id: string, reason: FailReason) => Promise<SellerOrder>;
  returnOrder: (id: string, reason: ReturnReason, back: boolean) => Promise<SellerOrder>;
  bulkPack: (ids: string[]) => Promise<number>;
  bulkShip: (ids: string[]) => Promise<number>;
  // catalogue + stock (API)
  /** Replace products, collections and the log with the API's (keeps queued stock writes). */
  syncCatalog: (c: SellerCatalog) => void;
  /** Replace the register, promotions, customers and reviews with the API's (keeps unsent sales). */
  syncExtras: (x: SellerExtras) => void;
  /** Reload the register, promotions, customers and reviews from the API. */
  resyncExtras: () => Promise<void>;
  /** Reload the catalogue from the API. */
  resync: () => Promise<void>;
  /** POST / PUT the draft; resolves to the product id. Throws the ApiError. */
  saveProduct: (draft: ProductDraft) => Promise<string>;
  duplicateProduct: (id: string) => Promise<string>;
  setProductDraft: (id: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (
    variantId: string,
    delta: number,
    reason: StockReason,
    note: string,
  ) => string | null;
  quickAdjust: (variantId: string, delta: number) => void;
  /** Undo a movement (waits for queued writes, then `DELETE /api/inventory/movements/{id}`). */
  revertMovement: (id: string) => Promise<void>;
  // promotions, reviews, settings, inbox
  /** Create (`isNew`) or update; false when the API refused it (the error handler toasts). */
  savePromo: (p: Promotion, isNew: boolean) => Promise<boolean>;
  /** End it now; resolves the previous end for Undo (null when refused). */
  endPromo: (id: string) => Promise<string | null>;
  restorePromoEnd: (id: string, endsAt: string) => Promise<void>;
  replyReview: (id: string, text: string) => Promise<boolean>;
  /** Local only (e.g. keeping a saved workspace's name in step with the API). */
  updateShop: (patch: Partial<SellerDb['shop']>) => void;
  /** Settings: shown at once, saved with `PATCH /api/businesses/{id}`, put back if refused. */
  saveShop: (patch: Partial<SellerDb['shop']>) => Promise<boolean>;
  readNotif: (id: string) => void;
  readAllNotifs: () => void;
  // POS
  addToCart: (productId: string, variantId: string, qty?: number) => void;
  decLine: (index: number) => void;
  clearSale: () => CartLine[];
  restoreCart: (cart: CartLine[]) => void;
  setDiscount: (d: PosDiscount | null) => void;
  setCustomer: (c: string) => void;
  holdSale: () => void;
  resumeSale: (index: number) => void;
  openShift: (usd: number, khr: number) => Promise<boolean>;
  completeSale: (
    payments: { method: PaymentMethod; amount: number }[],
    cash?: CashTenderInfo,
  ) => SellerPosSale | null;
  refundSale: (
    saleId: string,
    lines: { variantId: string; qty: number }[],
    amount: number,
    method: PaymentMethod,
    back: boolean,
  ) => Promise<boolean>;
  cashMove: (amount: number, note: string) => Promise<boolean>;
  closeShift: (counted: number, diff: number) => Promise<boolean>;
  /** Send the sales rung up offline (or not yet confirmed); resolves how many went through. */
  flushPending: () => Promise<number>;
}

// localStorage that never throws (private mode, quota exceeded by large photos).
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useSellerStore = create<SellerState>()(
  persist(
    (set, get) => {
      /** Mutate a deep copy of the db and commit it. */
      /** Mutate a copy of the db without sending queued stock writes (server answers). */
      const patch = (fn: (d: SellerDb) => void) => {
        const cur = get().db;
        if (!cur) return;
        const d = structuredClone(cur);
        fn(d);
        set({ db: d });
      };
      /** Send queued stock writes one by one, in order; a failure reloads the catalogue. */
      let flushing: Promise<void> | null = null;
      const flush = (): Promise<void> => {
        flushing ??= (async () => {
          try {
            for (let batch = takePending(); batch.length; batch = takePending()) {
              for (let i = 0; i < batch.length; i++) {
                const w = batch[i]!;
                try {
                  const r = await postMovement(w.businessId, w.input);
                  idMap.set(w.localId, r.movement.id);
                  patch((d) => reconcileWrite(d, w.localId, r, batch.slice(i + 1)));
                } catch (e) {
                  clearPending();
                  onStockError?.(e);
                  await get().resync();
                  return;
                }
              }
            }
          } finally {
            flushing = null;
          }
        })();
        return flushing;
      };
      /** Provisional row id → the API's id (for Undo of a just-made change). */
      const idMap = new Map<string, string>();
      const update = <T>(fn: (d: SellerDb) => T): T => {
        const cur = get().db;
        if (!cur) throw new Error('seller store not seeded');
        const d = structuredClone(cur);
        const out = fn(d);
        set({ db: d });
        if (hasPending()) void flush();
        return out;
      };
      /** The one run of `flushPending` in flight. */
      let sending: Promise<number> | null = null;
      const businessId = () => {
        const id = get().db?.shop.id;
        if (!id) throw new Error('seller store not seeded');
        return id;
      };
      const upsertProduct = (p: SellerProduct) =>
        patch((d) => {
          const i = d.products.findIndex((x) => x.id === p.id);
          if (i >= 0) d.products[i] = p;
          else d.products.unshift(p);
          if (p.collection && !d.collections.includes(p.collection))
            d.collections.push(p.collection);
        });
      /** Put the server's version of these orders in the list (newest first). */
      const upsertOrders = (list: SellerOrder[]) =>
        patch((d) => {
          for (const o of list) {
            const i = d.orders.findIndex((x) => x.id === o.id);
            if (i >= 0) d.orders[i] = o;
            else d.orders.unshift(o);
          }
          d.orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });

      return {
        db: null,
        seed: (db) => set({ db }),
        reset: () => set({ db: null }),

        // ---------------- Orders (API) ----------------
        syncOrders: ({ orders, notifs }) =>
          patch((d) => {
            d.orders = orders;
            d.notifs = notifs;
          }),
        resyncOrders: async () => {
          const id = get().db?.shop.id;
          if (!id) return;
          try {
            get().syncOrders(await fetchSellerOrders(id));
          } catch {
            /* offline: the next event or reopen reloads them */
          }
        },
        acceptOrders: async (ids) => {
          const r = await orderApi.accept(businessId(), ids);
          upsertOrders(r.orders);
          return r.orders;
        },
        undoAccept: async (ids) => {
          upsertOrders((await orderApi.undoAccept(businessId(), ids)).orders);
        },
        rejectOrder: async (id, reason, markSoldOut) => {
          const o = await orderApi.reject(businessId(), id, reason, markSoldOut);
          upsertOrders([o]);
          await get().resync(); // its stock came back (and may have been marked sold out)
          return o;
        },
        packOrder: async (id) => {
          const o = await orderApi.pack(businessId(), id);
          upsertOrders([o]);
          return o;
        },
        shipOrder: async (id, own) => {
          const o = await orderApi.ship(
            businessId(),
            id,
            own ? 'OWN_DELIVERY' : 'VIRTUALBIZ_RIDER',
          );
          upsertOrders([o]);
          return o;
        },
        pickupOrder: async (id) => {
          const o = await orderApi.pickup(businessId(), id);
          upsertOrders([o]);
          return o;
        },
        deliverOrder: async (id) => {
          const o = await orderApi.deliver(businessId(), id);
          upsertOrders([o]);
          return o;
        },
        failDelivery: async (id, reason) => {
          const o = await orderApi.fail(businessId(), id, reason);
          upsertOrders([o]);
          return o;
        },
        returnOrder: async (id, reason, back) => {
          const o = await orderApi.giveBack(businessId(), id, reason, back);
          upsertOrders([o]);
          if (back) await get().resync();
          return o;
        },
        bulkPack: async (ids) => {
          const r = await orderApi.bulk(businessId(), 'PACK', ids);
          upsertOrders(r.orders);
          return r.orders.length;
        },
        bulkShip: async (ids) => {
          const r = await orderApi.bulk(businessId(), 'SHIP', ids);
          upsertOrders(r.orders);
          return r.orders.length;
        },

        // ---------------- Catalogue (API) ----------------
        syncCatalog: (c) =>
          patch((d) => {
            const local = d.log.filter((m) => isTmp(m.id));
            d.products = c.products.map((p) => ({
              ...p,
              variants: p.variants.map((v) => ({ ...v, stock: v.stock + pendingDelta(v.id) })),
            }));
            d.log = [...c.log, ...local].sort((a, b) => a.at.localeCompare(b.at));
            d.collections = c.collections;
          }),
        syncExtras: (x) =>
          patch((d) => {
            const unsent = d.pos.sales.filter((s) => d.pos.pending.includes(s.id));
            const known = new Set(x.sales.map((s) => s.id));
            d.promos = x.promos;
            d.reviews = x.reviews;
            d.customers = x.customers;
            d.pos.shift = x.shift;
            d.pos.shifts = x.shifts;
            d.pos.sales = [...x.sales, ...unsent.filter((s) => !known.has(s.id))];
            d.pos.pending = d.pos.pending.filter((id) => !known.has(id));
          }),
        resyncExtras: async () => {
          const id = get().db?.shop.id;
          if (!id) return;
          try {
            get().syncExtras(await fetchSellerExtras(id));
          } catch (e) {
            onStockError?.(e);
          }
        },
        resync: async () => {
          const id = get().db?.shop.id;
          if (!id) return;
          try {
            get().syncCatalog(await fetchSellerCatalog(id));
          } catch (e) {
            onStockError?.(e);
          }
        },
        saveProduct: async (draft) => {
          const biz = businessId();
          await flushing;
          const input = toProductInput(draft);
          const p = draft.id
            ? await replaceProduct(biz, draft.id, input)
            : await createProduct(biz, input);
          upsertProduct(p);
          // New variants opened with stock: their OPENING_STOCK rows are in the log now.
          await get().resync();
          return p.id;
        },
        duplicateProduct: async (id) => {
          const p = await duplicateProductApi(businessId(), id);
          upsertProduct(p);
          return p.id;
        },
        setProductDraft: async (id) => {
          upsertProduct(await setProductStatus(businessId(), id, 'DRAFT'));
        },
        deleteProduct: async (id) => {
          await deleteProductApi(businessId(), id);
          patch((d) => {
            d.products = d.products.filter((p) => p.id !== id);
          });
        },
        adjustStock: (variantId, delta, reason, note) =>
          update((d) => writeStock(d, { variantId, delta, reason, note })),
        quickAdjust: (variantId, delta) =>
          update((d) => {
            const [, v] = findVariant(d.products, variantId);
            if (!v || v.stock + delta < 0) return;
            writeStock(d, { variantId, delta, reason: 'QUICK_ADJUST', mergeQuick: true });
          }),
        revertMovement: async (localId) => {
          await flushing;
          const id = idMap.get(localId) ?? localId;
          if (isTmp(id)) return; // never reached the API (the failure reloaded the log)
          const before = get().db;
          patch((d) => revertStock(d, id));
          try {
            const r = await revertMovementApi(businessId(), id);
            patch((d) => {
              const [, v] = findVariant(d.products, r.variant.id);
              if (v) v.stock = r.variant.stock + pendingDelta(r.variant.id);
            });
          } catch (e) {
            if (before) set({ db: before });
            onStockError?.(e);
            await get().resync();
          }
        },

        // ---------------- Promotions, reviews, settings ----------------
        savePromo: async (p, isNew) => {
          try {
            const saved = await savePromotion(businessId(), p, isNew);
            patch((d) => {
              const i = d.promos.findIndex((x) => x.id === p.id || x.id === saved.id);
              if (i >= 0) d.promos[i] = saved;
              else d.promos.unshift(saved);
            });
            return true;
          } catch (e) {
            onStockError?.(e);
            return false;
          }
        },
        endPromo: async (id) => {
          try {
            const r = await endPromotion(businessId(), id);
            patch((d) => {
              const i = d.promos.findIndex((x) => x.id === id);
              if (i >= 0) d.promos[i] = r.promotion;
            });
            return r.previousEndsAt;
          } catch (e) {
            onStockError?.(e);
            return null;
          }
        },
        restorePromoEnd: async (id, endsAt) => {
          try {
            const p = await setPromotionEnd(businessId(), id, endsAt);
            patch((d) => {
              const i = d.promos.findIndex((x) => x.id === id);
              if (i >= 0) d.promos[i] = p;
            });
          } catch (e) {
            onStockError?.(e);
          }
        },
        replyReview: async (id, text) => {
          try {
            await replyReviewApi(businessId(), id, text);
            patch((d) => {
              const r = d.reviews.find((x) => x.id === id);
              if (r) r.reply = text || undefined;
            });
            return true;
          } catch (e) {
            onStockError?.(e);
            return false;
          }
        },
        updateShop: (patch) =>
          update((d) => {
            d.shop = { ...d.shop, ...patch };
          }),
        saveShop: async (p) => {
          const before = get().db?.shop;
          if (!before) return false;
          patch((d) => {
            d.shop = { ...d.shop, ...p };
          });
          try {
            await patchBusinessApi(before.id, shopPatch(p));
            return true;
          } catch (e) {
            patch((d) => {
              d.shop = before;
            });
            onStockError?.(e);
            return false;
          }
        },
        readNotif: (id) => {
          patch((d) => {
            const n = d.notifs.find((x) => x.id === id);
            if (n) n.unread = false;
          });
          void readNotificationApi(businessId(), id).catch(() => {});
        },
        readAllNotifs: () => {
          patch((d) => {
            d.notifs.forEach((n) => (n.unread = false));
          });
          void readAllNotificationsApi(businessId()).catch(() => {});
        },

        // ---------------- POS ----------------
        addToCart: (productId, variantId, qty = 1) =>
          update((d) => {
            const p = d.products.find((x) => x.id === productId);
            const v = p?.variants.find((x) => x.id === variantId);
            if (!p || !v) return;
            const l = d.pos.cart.find((x) => x.variantId === v.id);
            if (l) l.qty += qty;
            else
              d.pos.cart.push({
                productId: p.id,
                variantId: v.id,
                title: p.title,
                variantName: vname(v),
                unitPrice: v.price,
                qty,
              });
          }),
        decLine: (index) =>
          update((d) => {
            const l = d.pos.cart[index];
            if (!l) return;
            l.qty--;
            if (!l.qty) d.pos.cart.splice(index, 1);
          }),
        clearSale: () =>
          update((d) => {
            const prev = d.pos.cart;
            d.pos.cart = [];
            d.pos.disc = null;
            return prev;
          }),
        restoreCart: (cart) =>
          update((d) => {
            d.pos.cart = cart;
          }),
        setDiscount: (disc) =>
          update((d) => {
            d.pos.disc = disc;
          }),
        setCustomer: (c) =>
          update((d) => {
            d.pos.cust = c;
          }),
        holdSale: () =>
          update((d) => {
            d.pos.held.push({
              at: Date.now(),
              cart: d.pos.cart,
              disc: d.pos.disc,
              cust: d.pos.cust,
            });
            d.pos.cart = [];
            d.pos.disc = null;
            d.pos.cust = '';
          }),
        resumeSale: (index) =>
          update((d) => {
            const [h] = d.pos.held.splice(index, 1);
            if (!h) return;
            if (d.pos.cart.length)
              d.pos.held.push({
                at: Date.now(),
                cart: d.pos.cart,
                disc: d.pos.disc,
                cust: d.pos.cust,
              });
            d.pos.cart = h.cart;
            d.pos.disc = h.disc;
            d.pos.cust = h.cust;
          }),
        openShift: async (usd, khr) => {
          try {
            const sh = await posApi.open(businessId(), usd, khr);
            patch((d) => {
              d.pos.shift = sh;
            });
            return true;
          } catch (e) {
            onStockError?.(e);
            if (isApiError(e, 'SHIFT_ALREADY_OPEN')) await get().resyncExtras();
            return false;
          }
        },
        completeSale: (payments, cash) => {
          const out = update((d) => {
            if (!d.pos.shift) return null;
            const { sub, disc, total } = posTotals(d.pos);
            const s: SellerPosSale = {
              // The register's own id: the API keeps it as clientRef, so a retry is stored once.
              id: newId(),
              number: '',
              businessId: d.shop.id,
              shiftId: d.pos.shift.id,
              lines: d.pos.cart.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                title: l.title,
                variantName: l.variantName,
                qty: l.qty,
                unitPrice: l.unitPrice,
              })),
              subtotal: sub,
              discount: disc,
              ...(d.pos.disc ? { discountReason: d.pos.disc.reason } : {}),
              tip: 0,
              total,
              payments,
              ...(cash ? { cash } : {}),
              ...(d.pos.cust ? { customerName: d.pos.cust } : {}),
              refunds: [],
              at: new Date().toISOString(),
            };
            // Show the stock change at once; the API's count replaces it after the sale is sent.
            for (const l of s.lines) {
              const [, v] = findVariant(d.products, l.variantId);
              if (v) v.stock -= l.qty;
            }
            d.pos.sales.push(s);
            d.pos.pending.push(s.id);
            d.pos.cart = [];
            d.pos.disc = null;
            d.pos.cust = '';
            return s;
          });
          if (out && (typeof navigator === 'undefined' || navigator.onLine !== false))
            void get().flushPending();
          return out;
        },
        refundSale: async (saleId, lines, amount, method, back) => {
          const s = get().db?.pos.sales.find((x) => x.id === saleId);
          if (!s?.number) return false;
          try {
            const r = await posApi.refund(businessId(), s.number, lines, amount, method, back);
            patch((d) => {
              const i = d.pos.sales.findIndex((x) => x.id === saleId);
              if (i >= 0) d.pos.sales[i] = r;
            });
            if (back) await get().resync();
            return true;
          } catch (e) {
            onStockError?.(e);
            return false;
          }
        },
        cashMove: async (amount, note) => {
          const db = get().db;
          if (!db?.pos.shift || shiftCash(db.pos) + amount < 0) return false;
          try {
            const sh = await posApi.move(businessId(), amount, note);
            patch((d) => {
              d.pos.shift = sh;
            });
            return true;
          } catch (e) {
            onStockError?.(e);
            return false;
          }
        },
        closeShift: async (counted) => {
          // Sales still waiting to be sent belong to this shift: send them first.
          await get().flushPending();
          try {
            const closed = await posApi.close(businessId(), counted);
            patch((d) => {
              d.pos.shifts.unshift(closed);
              d.pos.shift = null;
            });
            return true;
          } catch (e) {
            onStockError?.(e);
            return false;
          }
        },
        flushPending: () => {
          if (sending) return sending;
          const run = (async () => {
            let sent = 0;
            try {
              for (;;) {
                const db = get().db;
                const id = db?.pos.pending[0];
                const s = id ? db.pos.sales.find((x) => x.id === id) : undefined;
                if (!db || !id) break;
                if (!s) {
                  patch((d) => {
                    d.pos.pending.shift();
                  });
                  continue;
                }
                try {
                  const saved = await posApi.ring(db.shop.id, {
                    clientRef: s.id,
                    lines: s.lines.map((l) => ({
                      variantId: l.variantId,
                      qty: l.qty,
                      unitPrice: l.unitPrice,
                    })),
                    discount: s.discount,
                    ...(s.discountReason ? { discountReason: s.discountReason } : {}),
                    ...(s.customerName ? { customerName: s.customerName } : {}),
                    payments: s.payments,
                    ...(s.cash
                      ? { cash: { usd: s.cash.usd, khr: s.cash.khr, change: s.cash.change } }
                      : {}),
                    at: s.at,
                  });
                  patch((d) => {
                    const i = d.pos.sales.findIndex((x) => x.id === s.id);
                    if (i >= 0) d.pos.sales[i] = saved;
                    d.pos.pending = d.pos.pending.filter((x) => x !== s.id);
                  });
                  sent++;
                } catch (e) {
                  // Offline: keep it queued. Refused (e.g. not enough stock): drop it and say so.
                  if (isApiError(e, 'NETWORK_ERROR') || !isApiError(e)) break;
                  patch((d) => {
                    d.pos.sales = d.pos.sales.filter((x) => x.id !== s.id);
                    d.pos.pending = d.pos.pending.filter((x) => x !== s.id);
                  });
                  onStockError?.(e);
                }
              }
              if (sent) await get().resync();
            } catch {
              /* the next flush tries again */
            }
            return sent;
          })();
          // Cleared once settled (not inside the run: it may finish before this assignment).
          sending = run;
          void run.finally(() => {
            if (sending === run) sending = null;
          });
          return run;
        },
      };
    },
    {
      name: 'vb-seller',
      // v2: products, collections and the stock log come from the API (ids are UUIDs).
      // v3: orders and the inbox come from the API.
      // v4: the register, promotions, customers and reviews come from the API.
      version: 4,
      migrate: () => ({ db: null }),
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ db: s.db }),
      skipHydration: true,
    },
  ),
);

export { shiftFloat };
