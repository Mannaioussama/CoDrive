'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './api';
import { DEFAULT_WORKSPACE, type WorkspaceSettings } from './workspace';
const CACHE = 'codrive-workspace-v1';
export function useWorkspace(enabled = true) {
 const [settings, setSettings] = useState(DEFAULT_WORKSPACE);
 const [ready, setReady] = useState(false);
 const [error, setError] = useState('');
 const [connected, setConnected] = useState(false);
 const [systemDark, setSystemDark] = useState(false);
 const refresh = useCallback(async () => {
  try { const value = await apiRequest<WorkspaceSettings>('/settings'); setSettings(value); setConnected(true); setError(''); try { localStorage.setItem(CACHE, JSON.stringify(value)); } catch {} }
  catch { setConnected(false); setError('Paramètres indisponibles : démarrez l’API pour enregistrer vos préférences.'); }
  finally { setReady(true); }
 }, []);
 useEffect(() => {
  if (!enabled) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const frame = requestAnimationFrame(() => {
   setSystemDark(media.matches);
   try { const cache = localStorage.getItem(CACHE); if (cache) { const value = JSON.parse(cache); setSettings({ ...DEFAULT_WORKSPACE, ...value, dashboardType: value.dashboardType === 'compact' ? 'intelligent' : value.dashboardType }); } } catch {}
   void refresh();
  });
  const changed = () => setSystemDark(media.matches);
  const online = () => { void refresh(); };
  media.addEventListener('change', changed); window.addEventListener('online', online);
  return () => { cancelAnimationFrame(frame); media.removeEventListener('change', changed); window.removeEventListener('online', online); };
 }, [refresh, enabled]);
 const save = async (value: WorkspaceSettings) => {
  const result = await apiRequest<WorkspaceSettings>('/settings', { method: 'PUT', body: JSON.stringify(value) });
  setSettings(result); setConnected(true); setError('');
  try { localStorage.setItem(CACHE, JSON.stringify(result)); } catch {}
  return result;
 };
 return { settings, ready, connected, error, refresh, save, systemDark };
}
