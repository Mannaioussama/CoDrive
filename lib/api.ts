import type { Store } from './resources';
export class ApiError extends Error { constructor(message: string, public readonly status: number) { super(message); this.name = 'ApiError'; } }
export const EMPTY_STORE: Store = { employees: [], tasks: [], shifts: [], equipment: [], stock: [] };
export const API_CACHE_KEY = 'fleetpro-api-cache-v1';
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
 let response: Response;
 try {
  response = await fetch(`/api${path}`, { ...options, cache: 'no-store', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, signal: AbortSignal.timeout(15000) });
 } catch {
  throw new ApiError(options.method && options.method !== 'GET' ? 'Confirmation du serveur non reçue. Actualisez les données avant de réessayer pour vérifier si la modification a été enregistrée.' : 'API indisponible. Vérifiez que NestJS et MongoDB sont démarrés.', 0);
 }
 if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('codrive-session-ended'));
 if (!response.ok) {
  const body = await response.json().catch(() => null);
  const message = body?.message;
  throw new ApiError(Array.isArray(message) ? message.join(' · ') : typeof message === 'string' ? message : `Le serveur a refusé la requête (${response.status}).`, response.status);
 }
 return response.json();
}
