import { apiRequest } from '../../../lib/api';

export async function billingGet<T>(path: string): Promise<T> {
 return apiRequest<T>(`/billing${path}`);
}
export async function billingSend<T>(method: string, path: string, body?: unknown): Promise<T> {
 return apiRequest<T>(`/billing${path}`, {
  method,
  body: body ? JSON.stringify(body) : undefined,
 });
}
