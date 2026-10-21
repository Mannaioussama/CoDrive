'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_CACHE_KEY, EMPTY_STORE, ApiError, apiRequest } from './api';
import type { Store } from './resources';
function cache(store: Store) { try { localStorage.setItem(API_CACHE_KEY, JSON.stringify(store)); } catch { /* Server persistence is unaffected by an unavailable browser cache. */ } }
export function useResources() {
 const [store, setStore] = useState<Store>(EMPTY_STORE);
 const [ready, setReady] = useState(false);
 const [connected, setConnected] = useState(false);
 const [busy, setBusy] = useState(false);
 const [apiError, setApiError] = useState('');
 const revision = useRef(0), writing = useRef(false), mounted = useRef(false);
 const refresh = useCallback(async () => {
  if (writing.current) return;
  const request = ++revision.current;
  try {
   const data = await apiRequest<Store>('/resources');
   if (mounted.current && revision.current === request && !writing.current) { setStore(data); setConnected(true); setApiError(''); cache(data); }
  } catch (error) {
   if (mounted.current && revision.current === request) { setConnected(false); setApiError(error instanceof Error ? error.message : 'API indisponible.'); }
  } finally { if (mounted.current) setReady(true); }
 }, []);
 useEffect(() => {
  mounted.current = true;
  const frame = requestAnimationFrame(() => {
   try { const stored = localStorage.getItem(API_CACHE_KEY); if (stored) { const data = JSON.parse(stored); if (Object.keys(EMPTY_STORE).every(key => Array.isArray(data[key]))) setStore(data); } } catch { /* An invalid cache is replaced by the server snapshot. */ }
   void refresh();
  });
  const offline = () => { revision.current++; setConnected(false); setApiError('Hors ligne : consultation de la dernière copie disponible.'); setReady(true); };
  const online = () => { void refresh(); };
  const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
  window.addEventListener('online', online); window.addEventListener('offline', offline); document.addEventListener('visibilitychange', visible);
  const timer = setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') void refresh(); }, 30000);
  return () => { mounted.current = false; cancelAnimationFrame(frame); clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); document.removeEventListener('visibilitychange', visible); };
 }, [refresh]);
 const mutate = useCallback(async <T,>(path: string, options: RequestInit, getStore: (response: T) => Store): Promise<T> => {
  if (!navigator.onLine) throw new Error('Hors ligne : les modifications nécessitent une connexion au serveur.');
  if (writing.current) throw new Error('Une modification est en cours. Patientez un instant.');
  writing.current = true; revision.current++; setBusy(true);
  try {
   const response = await apiRequest<T>(path, options);
   const next = getStore(response);
   if (mounted.current) { setStore(next); setConnected(true); setApiError(''); cache(next); }
   return response;
  } catch (error) {
   if (mounted.current && error instanceof ApiError && (error.status === 0 || error.status >= 500)) { setConnected(false); setApiError(error.message); }
   throw error;
  } finally { writing.current = false; if (mounted.current) setBusy(false); }
 }, []);
 return { store, ready, connected, busy, apiError, refresh, mutate };
}
