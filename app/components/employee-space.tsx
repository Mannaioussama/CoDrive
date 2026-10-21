'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { roleLabels, roleModules } from '../../lib/access';
import type { Task, Shift } from '../../lib/resources';
import { useAuth, logout } from './auth-gate';
export function EmployeeSpace({ embedded = false }: { embedded?: boolean }) {
 const user = useAuth();
 const [data, setData] = useState<{tasks: Task[]; shifts: Shift[]}>({ tasks: [], shifts: [] });
 const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const refresh = async () => { try { setData(await apiRequest('/me/tasks')); setError(''); } catch { setError('Impossible de charger vos missions.'); } };
 useEffect(() => { const frame = requestAnimationFrame(() => { void refresh(); }); const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000); return () => { cancelAnimationFrame(frame); clearInterval(timer); }; }, []);
 async function update(id: string, progress: string) { setBusy(true); try { await apiRequest(`/me/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ progress }) }); await refresh(); } catch { setError('Modification impossible.'); } finally { setBusy(false); } }
 return <section className="employee-space">{!embedded && <header><div><strong>coDrive</strong><p>{user.email} · {roleLabels[user.role]}</p></div><button className="btn ghost" onClick={() => void logout().catch(() => setError('Déconnexion impossible. Réessayez.'))}>Déconnexion</button></header>}<h1>Mon espace</h1>
 <section className="panel access-note"><h2>{roleModules[user.role]}</h2><p>Votre rôle est associé à ce module. Son interface métier sera disponible dans une prochaine version.</p></section>
 <div className="section-heading"><h2>Mes tâches</h2><button className="btn ghost" onClick={() => void refresh()}>Actualiser</button></div>{error && <p role="alert">{error}</p>}
 {!data.tasks.length && <section className="panel access-note">Aucune tâche ne vous est affectée.</section>}
 <div className="personal-tasks">{data.tasks.map(t => <article className="panel access-note" key={t.id}><h3>{t.title}</h3><p>{t.client} · {t.location}</p><p>{t.date} · {t.start}–{t.end}</p><label>Avancement<select value={t.progress || 'À faire'} disabled={busy} onChange={e => void update(t.id, e.target.value)}>{['À faire','En cours','Terminée'].map(s => <option key={s}>{s}</option>)}</select></label></article>)}</div><h2>Mes horaires</h2><div className="personal-tasks">{data.shifts.map(s => <article className="panel access-note" key={s.id}>{s.date} · {s.start}–{s.end}</article>)}</div>
 </section>;
}
