'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { roleLabels, roleModules } from '../../lib/access';
import type { Task, Shift } from '../../lib/resources';
import { useAuth, logout } from './auth-gate';
import { Badge, Empty, Icon } from './ui';

const MODULE_READY = new Set(['ADMIN', 'AGENT_FACTURATION']);

export function EmployeeSpace({ embedded = false }: { embedded?: boolean }) {
 const user = useAuth();
 const [data, setData] = useState<{ tasks: Task[]; shifts: Shift[] }>({ tasks: [], shifts: [] });
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const refresh = async () => {
  try { setData(await apiRequest('/me/tasks')); setError(''); }
  catch { setError('Impossible de charger vos missions.'); }
 };
 useEffect(() => {
  const frame = requestAnimationFrame(() => { void refresh(); });
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
  return () => { cancelAnimationFrame(frame); clearInterval(timer); };
 }, []);
 async function update(id: string, progress: string) {
  setBusy(true);
  try { await apiRequest(`/me/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ progress }) }); await refresh(); }
  catch { setError('Modification impossible.'); }
  finally { setBusy(false); }
 }

 return (
  <section className={`employee-space${embedded ? ' embedded' : ''}`}>
   {!embedded && (
    <header>
     <div><strong>coDrive</strong><p>{user.email} · {roleLabels[user.role]}</p></div>
     <button className="btn ghost" onClick={() => void logout().catch(() => setError('Déconnexion impossible. Réessayez.'))}>Déconnexion</button>
    </header>
   )}

   <div className="section-heading">
    <div>
     <div className="overline">VOTRE ESPACE PERSONNEL</div>
     <h1>Mon espace<span>.</span></h1>
     <p>Missions et horaires qui vous sont affectés.</p>
    </div>
    <button className="btn ghost small-btn" disabled={busy} onClick={() => void refresh()}><Icon name="calendar" size={15}/> Actualiser</button>
   </div>

   {!MODULE_READY.has(user.role) && (
    <section className="panel access-note">
     <h2>{roleModules[user.role]}</h2>
     <p>Votre rôle est associé à ce module. Son interface métier sera disponible dans une prochaine version.</p>
    </section>
   )}

   {error && <p className="form-error" role="alert">{error}</p>}

   <section className="panel personal-panel">
    <div className="panel-heading">
     <div>
      <h3>Mes tâches <span className="number-badge">{data.tasks.length}</span></h3>
      <p>Suivez l’avancement de vos missions.</p>
     </div>
    </div>
    {!data.tasks.length ? (
     <Empty text="Aucune tâche ne vous est affectée." />
    ) : (
     <div className="personal-tasks">
      {data.tasks.map(t => (
       <article className="personal-card" key={t.id}>
        <div className="personal-card-top">
         <div>
          <h4>{t.title}</h4>
          <p>{t.client} · {t.location}</p>
         </div>
         <Badge tone={t.progress === 'Terminée' ? 'green' : t.progress === 'En cours' ? 'blue' : 'gray'}>{t.progress || 'À faire'}</Badge>
        </div>
        <div className="personal-card-meta">
         <span><Icon name="calendar" size={13}/>{t.date}</span>
         <span><Icon name="clock" size={13}/>{t.start}–{t.end}</span>
        </div>
        <label className="field">Avancement
         <select value={t.progress || 'À faire'} disabled={busy} onChange={e => void update(t.id, e.target.value)}>
          {['À faire', 'En cours', 'Terminée'].map(s => <option key={s}>{s}</option>)}
         </select>
        </label>
       </article>
      ))}
     </div>
    )}
   </section>

   <section className="panel personal-panel">
    <div className="panel-heading">
     <div>
      <h3>Mes horaires <span className="number-badge">{data.shifts.length}</span></h3>
      <p>Créneaux de travail de la semaine.</p>
     </div>
    </div>
    {!data.shifts.length ? (
     <Empty text="Aucun créneau planifié pour le moment." />
    ) : (
     <div className="table-scroll">
      <table>
       <thead><tr><th>Date</th><th>Début</th><th>Fin</th></tr></thead>
       <tbody>
        {data.shifts.map(s => (
         <tr key={s.id}>
          <td>{s.date}</td>
          <td className="mono">{s.start}</td>
          <td className="mono">{s.end}</td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </section>
  </section>
 );
}
