'use client';

import {
  ApptDrawer,
  ApptForm,
  BlockForm,
  RequestsDrawer,
  SlotChooser,
} from '@/features/provider-calendar';
import { ClientDrawer, NewClientForm } from '@/features/provider-clients';
import { DealForm, ReplyForm } from '@/features/provider-marketing';
import { Checkout, Receipt } from '@/features/provider-sales';
import { ServiceForm } from '@/features/provider-services';
import { ConfirmBox } from '@/features/provider-shared/components/Overlay';
import { useUi } from '@/features/provider-shared/store';
import { StaffForm } from '@/features/provider-team';

import { Palette } from './Palette';

/** Renders the one open overlay (the prototype keeps a single #ov at a time). */
export function OverlayHost() {
  const o = useUi((s) => s.overlay);
  if (!o) return null;
  switch (o.t) {
    case 'appt':
      return <ApptDrawer key={o.id} id={o.id} />;
    case 'apptForm':
      return <ApptForm key={JSON.stringify(o.opts)} opts={o.opts} />;
    case 'checkout':
      return <Checkout key={o.id ?? 'quick'} id={o.id} />;
    case 'receipt':
      return <Receipt key={o.saleId} saleId={o.saleId} change={o.change} />;
    case 'requests':
      return <RequestsDrawer />;
    case 'client':
      return <ClientDrawer key={o.id} id={o.id} />;
    case 'newClient':
      return <NewClientForm />;
    case 'slot':
      return <SlotChooser staffId={o.staffId} date={o.date} start={o.start} />;
    case 'block':
      return <BlockForm date={o.date} start={o.start} staffId={o.staffId} />;
    case 'confirm':
      return <ConfirmBox key={o.opts.title} />;
    case 'svcForm':
      return <ServiceForm key={o.id ?? 'new'} id={o.id} />;
    case 'staffForm':
      return <StaffForm key={o.id ?? 'new'} id={o.id} />;
    case 'dealForm':
      return <DealForm key={o.id ?? 'new'} id={o.id} />;
    case 'reply':
      return <ReplyForm key={o.reviewId} reviewId={o.reviewId} />;
    case 'palette':
      return <Palette />;
  }
}
