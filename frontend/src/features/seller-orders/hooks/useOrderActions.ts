'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { fallbackErrorKey, isApiError } from '@/lib/api';
import { formatUsd } from '@/lib/money';

import {
  findVariant,
  orderCustomer,
  payLabel,
  useSellerStore,
  useUi,
  type FailReason,
  type RejectReason,
  type ReturnReason,
  useMethodName,
} from '@/features/seller-shared';

/**
 * The order flow's user actions (accept, reject, pack, ship, deliver, fail, return), each sent
 * to the order API (docs/api/phase3-orders-checkout.md § Seller); the store takes the server's
 * order back. A refused change (someone else moved it, the window passed) reloads the orders.
 */
export function useOrderActions() {
  const t = useTranslations('seller.orders');
  const tc = useTranslations('common');
  const tp = useMethodName();
  return useMemo(() => {
    const st = () => useSellerStore.getState();
    const ui = () => useUi.getState();
    const db = () => st().db!;
    const get = (id: string) => db().orders.find((o) => o.id === id);
    const custName = (id: string) => {
      const o = get(id);
      return o ? orderCustomer(db(), o).name : '';
    };

    /** Runs an API action; on failure shows why and reloads the orders. */
    const run = async <T>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        ui().showToast(
          isApiError(e, 'INVALID_STATUS_TRANSITION', 'ORDER_NOT_FOUND')
            ? t('toast.changed')
            : isApiError(e, 'UNDO_WINDOW_PASSED')
              ? t('toast.undoTooLate')
              : isApiError(e, 'RETURN_WINDOW_PASSED')
                ? t('toast.returnTooLate')
                : tc(fallbackErrorKey(e)),
        );
        void st().resyncOrders();
        return null;
      }
    };

    const accept = async (ids: string[]) => {
      ui().close(true);
      const list = await run(() => st().acceptOrders(ids));
      if (!list?.length) return;
      const accepted = list.map((o) => o.id);
      ui().showToast(
        list.length > 1
          ? t('toast.acceptedMany', { n: list.length })
          : t('toast.accepted', { no: list[0]!.number }),
        { label: t('undo'), fn: () => void run(() => st().undoAccept(accepted)) },
      );
    };

    const reject = async (id: string) => {
      const o = get(id);
      if (!o) return;
      ui().close(true);
      const oos = o.lines.some((l) => {
        const [, v] = findVariant(db().products, l.variantId);
        return v && v.stock === 0;
      });
      const reasons: RejectReason[] = ['outOfStock', 'cantDeliver', 'listingError', 'closingEarly'];
      const r = await ui().confirm({
        title: t('reject.title', { no: o.number }),
        body:
          t('reject.body', { name: custName(o.id) }) +
          (o.payment.paid ? ' ' + t('reject.refunded') : ''),
        ok: t('reject.ok'),
        danger: true,
        fields: [
          {
            type: 'select',
            key: 'reason',
            label: t('reason'),
            options: reasons.map((k) => ({ value: k, label: t(`reasons.reject.${k}`) })),
          },
          {
            type: 'switch',
            key: 'oos',
            label: t('reject.soldOut'),
            hint: t('reject.soldOutHint'),
            value: oos,
          },
        ],
      });
      if (!r) return;
      const done = await run(() => st().rejectOrder(id, r.reason as RejectReason, !!r.oos));
      if (!done) return;
      ui().showToast(
        done.paymentStatus === 'REFUNDED'
          ? t('toast.rejectedRefund', { no: o.number })
          : t('toast.rejected', { no: o.number }),
      );
    };

    const pack = (id: string) => {
      ui().close(true);
      ui().open({ kind: 'pack', id });
    };

    const ship = async (id: string) => {
      const o = get(id);
      if (!o) return;
      ui().close(true);
      if (o.method === 'PICKUP') {
        if (await run(() => st().pickupOrder(id)))
          ui().showToast(t('toast.pickedUp', { no: o.number }));
        return;
      }
      ui().open({ kind: 'ship', id });
    };

    const delivered = async (id: string) => {
      const o = get(id);
      if (!o) return;
      ui().close(true);
      if (!(await run(() => st().deliverOrder(id)))) return;
      ui().showToast(
        o.payment.channel === 'COD'
          ? t('toast.deliveredCod', { no: o.number, amount: formatUsd(o.total) })
          : t('toast.delivered', { no: o.number }),
      );
    };

    const failed = async (id: string) => {
      const o = get(id);
      if (!o) return;
      ui().close(true);
      const reasons: FailReason[] = ['noAnswer', 'wrongAddress', 'refused'];
      const r = await ui().confirm({
        title: t('failed.title'),
        body: t('failed.body'),
        ok: t('failed.ok'),
        fields: [
          {
            type: 'select',
            key: 'r',
            label: t('failed.what'),
            options: reasons.map((k) => ({ value: k, label: t(`reasons.failed.${k}`) })),
          },
        ],
      });
      if (!r) return;
      if (await run(() => st().failDelivery(id, r.r as FailReason)))
        ui().showToast(t('toast.failed', { no: o.number }));
    };

    const giveBack = async (id: string) => {
      const o = get(id);
      if (!o) return;
      ui().close(true);
      const pay = payLabel(o);
      const reasons: ReturnReason[] = ['damaged', 'wrongItem', 'changedMind'];
      const r = await ui().confirm({
        title: t('return.title', { no: o.number }),
        body: t('return.body', {
          amount: formatUsd(o.total),
          name: custName(o.id),
          method: pay === 'COD' ? t('return.cashOrKhqr') : tp(pay),
        }),
        ok: t('return.ok'),
        danger: true,
        fields: [
          {
            type: 'select',
            key: 'r',
            label: t('reason'),
            options: reasons.map((k) => ({ value: k, label: t(`reasons.returned.${k}`) })),
          },
          {
            type: 'switch',
            key: 'back',
            label: t('return.back'),
            hint: t('return.backHint'),
            value: true,
          },
        ],
      });
      if (!r) return;
      if (await run(() => st().returnOrder(id, r.r as ReturnReason, !!r.back)))
        ui().showToast(t('toast.refundStarted', { amount: formatUsd(o.total) }));
    };

    const bulkPack = async (ids: string[]) => {
      const n = await run(() => st().bulkPack(ids));
      if (n != null) ui().showToast(t('toast.bulkPacked', { n }));
    };
    const bulkShip = async (ids: string[]) => {
      const n = await run(() => st().bulkShip(ids));
      if (n != null) ui().showToast(t('toast.bulkShipped', { n }));
    };

    return {
      run,
      accept,
      reject,
      pack,
      ship,
      delivered,
      failed,
      giveBack,
      bulkPack,
      bulkShip,
      open: (id: string) => {
        ui().close(true);
        ui().open({ kind: 'order', id });
      },
      invoice: (id: string) => ui().open({ kind: 'invoice', id }),
    };
  }, [t, tc, tp]);
}
