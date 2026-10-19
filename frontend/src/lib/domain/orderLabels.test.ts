import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES } from './enums';
import { customerOrderLabel } from './orderLabels';

describe('customerOrderLabel', () => {
  it('maps every status', () => {
    for (const s of ORDER_STATUSES) expect(customerOrderLabel(s)).toBeTruthy();
  });
  it('uses the doc labels', () => {
    expect(customerOrderLabel('NEW')).toBe('Order placed');
    expect(customerOrderLabel('ACCEPTED')).toBe('Preparing');
    expect(customerOrderLabel('SHIPPED')).toBe('On the way');
    expect(customerOrderLabel('PICKED_UP')).toBe('Picked up');
  });
  it('splits PACKED by fulfilment method', () => {
    expect(customerOrderLabel('PACKED', 'PICKUP')).toBe('Ready for pickup');
    expect(customerOrderLabel('PACKED', 'DELIVERY')).toBe('Ready');
  });
});
