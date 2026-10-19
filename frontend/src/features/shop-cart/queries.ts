// Server cart (docs/api/phase3-orders-checkout.md § Cart) and the mapping between its lines
// (variant ids) and the customer UI's lines (listing slug + chosen options).
import { api, type ApiCart, type CartInput } from '@/lib/api';

import { variantFor } from '@/features/shop-shared/rules';
import type { CartLine, Item } from '@/features/shop-shared/types';

export const fetchCart = () => api.get<ApiCart>('/me/cart');
export const replaceCart = (input: CartInput) => api.put<ApiCart>('/me/cart', input);
export const mergeCart = (input: CartInput) => api.post<ApiCart>('/me/cart/merge', input);

/** Server cart → the store's `cart` / `later`. */
export function fromApiCart(c: ApiCart): { cart: CartLine[]; later: CartLine[] } {
  const toLine = (l: ApiCart['lines'][number]): CartLine => ({
    pid: l.productSlug,
    sel: { ...l.options },
    qty: l.qty,
    on: l.selected,
  });
  return { cart: c.lines.map(toLine), later: c.later.map(toLine) };
}

/** The variant a UI line refers to (undefined when the listing is gone from the catalogue). */
export function variantIdOf(l: CartLine, item: (id: string) => Item | undefined) {
  const it = item(l.pid);
  return it ? variantFor(it, l.sel)?.id : undefined;
}

/** The store's lines → `CartInput` (lines whose listing is gone are left out). */
export function toCartInput(
  cart: CartLine[],
  later: CartLine[],
  item: (id: string) => Item | undefined,
): CartInput {
  const map = (ls: CartLine[], withSel: boolean) =>
    ls.flatMap((l) => {
      const variantId = variantIdOf(l, item);
      return variantId ? [{ variantId, qty: l.qty, ...(withSel ? { selected: l.on } : {}) }] : [];
    });
  return { lines: map(cart, true), later: map(later, false) };
}
