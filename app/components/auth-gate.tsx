'use client';
import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { apiRequest, API_CACHE_KEY } from '../../lib/api';
import type { AuthUser } from '../../lib/access';
const UserContext = createContext<AuthUser | null>(null);
export const useAuth = () => useContext(UserContext)!;
function clearCache() { try { localStorage.removeItem(API_CACHE_KEY); localStorage.removeItem('codrive-workspace-v1'); } catch {} }
export function AuthGate({ children }: { children: ReactNode }) {
 const [state, setState] = useState<'loading' | 'activation' | 'login' | 'authenticated'>('loading');
 const [user, setUser] = useState<AuthUser | null>(null);
 const [token, setToken] = useState('');
 const [error, setError] = useState(''); const [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(false);
 const check = async () => {
  try { await apiRequest('/auth/status');
   try { const user = await apiRequest<AuthUser>('/auth/me'); setUser(user); setState('authenticated'); } catch { clearCache(); setState('login'); }
  } catch { setState('loading'); setError('Serveur indisponible. Vérifiez votre connexion puis réessayez.'); }
 };
 useEffect(() => {
  const frame = requestAnimationFrame(() => {
   const activation = new URLSearchParams(window.location.search).get('activation');
   if (activation) { setToken(activation); setState('activation'); window.history.replaceState({}, '', '/'); }
   else void check();
  });
  const expired = () => { clearCache(); setUser(null); setState('login'); };
  window.addEventListener('codrive-session-ended', expired);
  return () => { cancelAnimationFrame(frame); window.removeEventListener('codrive-session-ended', expired); };
 }, []);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
  try {
   if (state === 'activation') {
    if (data.get('password') !== data.get('confirm')) throw new Error('Les mots de passe ne correspondent pas.');
    await apiRequest('/auth/activate', { method: 'POST', body: JSON.stringify({ token, password: data.get('password') }) });
    setToken(''); setState('login'); setNotice('Compte activé. Vous pouvez maintenant vous connecter.');
   } else {
    const user = await apiRequest<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) }); clearCache(); setUser(user); setState('authenticated');
   }
  } catch (e) { setError(e instanceof Error ? e.message : 'Connexion impossible.'); }
  finally { setBusy(false); }
 }
 if (state === 'authenticated' && user) return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
 return <main className="auth-page"><section className="auth-card"><div className="auth-brand">coDrive<span>GESTION DE VOTRE AGENCE</span></div>
 <h1>{state === 'activation' ? 'Activer mon compte' : state === 'loading' ? 'Connexion à votre espace…' : 'Bienvenue'}</h1>
 <p>{state === 'activation' ? 'Choisissez votre mot de passe pour accepter votre invitation.' : state === 'login' ? 'Accès réservé aux administrateurs et aux employés invités.' : 'Vérification de votre session.'}</p>
 {notice && <p role="status">{notice}</p>}
 {state !== 'loading' && <form key={state} onSubmit={submit}>{state === 'login' && <label>Adresse e-mail<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}<PasswordField name="password" label="Mot de passe" autoComplete={state === 'activation' ? 'new-password' : 'current-password'}/>{state === 'activation' && <PasswordField name="confirm" label="Confirmer le mot de passe" autoComplete="new-password"/>}<button className="btn primary" disabled={busy}>{busy ? 'Veuillez patienter…' : state === 'activation' ? 'Activer mon compte' : 'Se connecter'}</button></form>}
 {error && <p className="auth-error" role="alert">{error}</p>}{state === 'loading' && error && <button className="btn primary" onClick={() => void check()}>Réessayer</button>}
 </section></main>;
}
export async function logout() { await apiRequest('/auth/logout', { method: 'POST' }); clearCache(); window.dispatchEvent(new Event('codrive-session-ended')); }

function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
 const [visible, setVisible] = useState(false);
 return <div className="auth-password-field"><label htmlFor={`auth-${name}`}>{label}</label><div className="auth-password-input"><input id={`auth-${name}`} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required minLength={8} maxLength={128}/><button type="button" className="password-toggle" aria-label={`${visible ? 'Masquer' : 'Afficher'} ${name === 'confirm' ? 'la confirmation du mot de passe' : 'le mot de passe'}`} aria-pressed={visible} aria-controls={`auth-${name}`} onClick={() => setVisible(!visible)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg></button></div></div>;
}
