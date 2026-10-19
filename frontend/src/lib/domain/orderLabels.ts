import type { FulfilmentMethod, OrderStatus } from './enums';

/**
 * Customer-facing label per OrderStatus (domain-model.md § Customer-facing order labels).
 * `PACKED` reads "Ready for pickup" on pickup orders and "Ready" on delivery orders.
 * UI code should translate via the message key; the English text is the fallback/reference.
 */
export type CustomerOrderLabelKey =
  | 'orderPlaced'
  | 'preparing'
  | 'readyForPickup'
  | 'ready'
  | 'onTheWay'
  | 'delivered'
  | 'pickedUp'
  | 'cancelled'
  | 'returned';

export const CUSTOMER_ORDER_LABELS_EN: Record<CustomerOrderLabelKey, string> = {
  orderPlaced: 'Order placed',
  preparing: 'Preparing',
  readyForPickup: 'Ready for pickup',
  ready: 'Ready',
  onTheWay: 'On the way',
  delivered: 'Delivered',
  pickedUp: 'Picked up',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const BY_STATUS: Record<Exclude<OrderStatus, 'PACKED'>, CustomerOrderLabelKey> = {
  NEW: 'orderPlaced',
  ACCEPTED: 'preparing',
  SHIPPED: 'onTheWay',
  DELIVERED: 'delivered',
  PICKED_UP: 'pickedUp',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

/** Label key for a status; use with `t(\`order.customerStatus.${key}\`)`. */
export function customerOrderLabelKey(
  status: OrderStatus,
  method: FulfilmentMethod = 'DELIVERY',
): CustomerOrderLabelKey {
  if (status === 'PACKED') return method === 'PICKUP' ? 'readyForPickup' : 'ready';
  return BY_STATUS[status];
}

/** English fallback label (for logs, tests and non-localized contexts). */
export function customerOrderLabel(
  status: OrderStatus,
  method: FulfilmentMethod = 'DELIVERY',
): string {
  return CUSTOMER_ORDER_LABELS_EN[customerOrderLabelKey(status, method)];
}
