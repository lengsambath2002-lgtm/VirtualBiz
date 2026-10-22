'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { CommandPalette, type PaletteCommand } from '@/features/command-palette';
import { CustomerDrawer } from '@/features/seller-customers';
import { AdjustDialog, ReceiveDialog, ScanDialog } from '@/features/seller-inventory';
import {
  InvoiceDialog,
  ManualOrderDialog,
  OrderDrawer,
  PackDialog,
  ShipDialog,
} from '@/features/seller-orders';
import {
  ChargeDialog,
  CloseShiftDialog,
  HeldDialog,
  OpenShiftDialog,
  ReceiptDialog,
  ReceiptsDialog,
  RefundDialog,
  VariantPickDialog,
} from '@/features/seller-pos';
import { CollectionsDialog, ProductQuickAdd } from '@/features/seller-products';
import { PromoForm } from '@/features/seller-promotions';
import { ReplyDialog } from '@/features/seller-reviews';
import {
  ConfirmDialog,
  Ic,
  orderCustomer,
  stockOf,
  useDb,
  useGo,
  useUi,
} from '@/features/seller-shared';
import { formatPhone } from '@/lib/utils/phone';

import { NAV } from './SellerRail';

function SellerPalette() {
  const t = useTranslations('seller.palette');
  const tn = useTranslations('seller.nav');
  const ts = useTranslations('seller.status');
  const db = useDb();
  const go = useGo();
  const close = useUi((u) => u.close);
  const commands = useMemo<PaletteCommand[]>(() => {
    return [
      ...db.orders.map((o) => ({
        id: `o-${o.id}`,
        group: t('orders'),
        label: `${o.number} · ${orderCustomer(db, o).name}`,
        sub: ts(o.status),
        icon: <Ic name="orders" size={18} />,
        keywords: o.number + orderCustomer(db, o).name,
        run: () =>
          void go('/seller/orders').then(
            (ok) => ok && setTimeout(() => useUi.getState().open({ kind: 'order', id: o.id }), 50),
          ),
      })),
      ...db.products.map((p) => ({
        id: `p-${p.id}`,
        group: t('products'),
        label: p.title,
        sub: t('inStock', { n: stockOf(p) }),
        icon: <Ic name="box" size={18} />,
        keywords: p.title + p.variants.map((v) => v.sku + v.barcode).join(' '),
        run: () => void go(`/seller/products/${p.id}`),
      })),
      ...db.customers.map((c) => ({
        id: `c-${c.id}`,
        group: t('customers'),
        label: c.name,
        sub: formatPhone(c.phone),
        icon: <Ic name="users" size={18} />,
        match: (q: string) => (c.name + c.phone).toLowerCase().includes(q.replace(/\s/g, '')),
        run: () => useUi.getState().open({ kind: 'customer', id: c.id }),
      })),
      ...[...NAV, { key: 'settings', href: '/seller/settings', icon: 'gear' as const }].map(
        (n) => ({
          id: `nav-${n.key}`,
          group: t('pages'),
          label: tn(n.key as 'home'),
          icon: <Ic name={n.icon} size={18} />,
          showWhenEmpty: true,
          run: () => void go(n.href),
        }),
      ),
    ];
  }, [db, go, t, tn, ts]);
  return (
    <CommandPalette
      open
      onClose={() => close(true)}
      commands={commands}
      groupLimits={{ [t('orders')]: 5, [t('products')]: 5, [t('customers')]: 4 }}
      placeholder={t('placeholder')}
      ariaLabel={t('label')}
      emptyLabel={t('none')}
    />
  );
}

/** Renders the one open overlay (prototype `overlay()`): modals, drawers, palette. */
export function OverlayHost() {
  const o = useUi((u) => u.overlay);
  if (!o) return null;
  switch (o.kind) {
    case 'confirm':
      return <ConfirmDialog key={o.spec.title} spec={o.spec} resolve={o.resolve} />;
    case 'order':
      return <OrderDrawer key={o.id} id={o.id} />;
    case 'manual':
      return <ManualOrderDialog />;
    case 'productAdd':
      return <ProductQuickAdd />;
    case 'collections':
      return <CollectionsDialog />;
    case 'customer':
      return <CustomerDrawer key={o.id} id={o.id} />;
    case 'pack':
      return <PackDialog id={o.id} />;
    case 'ship':
      return <ShipDialog id={o.id} />;
    case 'invoice':
      return <InvoiceDialog id={o.id} />;
    case 'palette':
      return <SellerPalette />;
    case 'scan':
      return <ScanDialog />;
    case 'receive':
      return <ReceiveDialog />;
    case 'adjust':
      return <AdjustDialog key={o.variantId} variantId={o.variantId} preset={o.preset} />;
    case 'promo':
      return <PromoForm key={o.id ?? 'new'} id={o.id} />;
    case 'reply':
      return <ReplyDialog id={o.id} />;
    case 'posOpen':
      return <OpenShiftDialog />;
    case 'posCharge':
      return <ChargeDialog />;
    case 'posReceipt':
      return <ReceiptDialog key={o.saleId} saleId={o.saleId} fresh={o.fresh} />;
    case 'posRefund':
      return <RefundDialog saleId={o.saleId} />;
    case 'posReceipts':
      return <ReceiptsDialog />;
    case 'posHeld':
      return <HeldDialog />;
    case 'posVariant':
      return <VariantPickDialog productId={o.productId} />;
    case 'posClose':
      return <CloseShiftDialog />;
  }
}
