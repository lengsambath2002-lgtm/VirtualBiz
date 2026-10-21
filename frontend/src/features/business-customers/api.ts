import { api, type ApiClient } from '@/lib/api';

export interface CustomerPatch {
  name?: string;
  phone?: string;
  /** Empty clears it. */
  email?: string;
  district?: string;
  note?: string;
}

/** `POST /api/clients`: a new customer record (name and phone required). */
export const createCustomer = (businessId: string, input: CustomerPatch) =>
  api.post<ApiClient>('/clients', input, { businessId });

/** `PATCH /api/clients/{id}` (docs/api/phase14-customers-exports.md): any member of the shop. */
export const patchCustomer = (businessId: string, clientId: string, input: CustomerPatch) =>
  api.patch<ApiClient>(`/clients/${clientId}`, input, { businessId });
