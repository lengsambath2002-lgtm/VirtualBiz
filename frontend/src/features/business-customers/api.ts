import { api, type ApiClient } from '@/lib/api';

export interface CustomerPatch {
  name?: string;
  phone?: string;
  /** Empty clears it. */
  email?: string;
  district?: string;
  note?: string;
}

/** `PATCH /api/clients/{id}` (docs/api/phase14-customers-exports.md): any member of the shop. */
export const patchCustomer = (businessId: string, clientId: string, input: CustomerPatch) =>
  api.patch<ApiClient>(`/clients/${clientId}`, input, { businessId });
