"use client";
import { useState, type FormEvent } from 'react';
import { accessRoles, roleLabels, fleetJobs, type AccessRole } from '../../../lib/access';
import { assignmentIssue, employeeStatuses, equipmentStatuses, type Kind, type Resource, type Shift, type Store, type Task } from '../../../lib/resources';
import { Icon } from '../../components/ui/icons';
import { Dialog } from '../../components/ui/dialog';

type Editor = { kind: Kind; item?: Resource; defaults?: Record<string, string> };
export type { Editor };

export function EditorModal({ editor, store, save, close, canWrite, today }: { editor: Editor; store: Store; save: (kind: Kind, item: Resource, accessRole?: string) => Promise<void>; close: () => void; canWrite: boolean; today: string }) {
 const { kind, item, defaults = {} } = editor;
 const values = (item || defaults) as unknown as Record<string, string | number>;
 const [error, setError] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [selectedAccessRole, setSelectedAccessRole] = useState<string>(() => item && kind === 'employees' ? fleetJobs.includes(String(values.role)) || values.role === roleLabels.GESTIONNAIRE_FLOTTE ? 'GESTIONNAIRE_FLOTTE' : accessRoles.find(r => roleLabels[r] === values.role) || '' : '');
 const names: Record<Kind, [string, string]> = { employees: ['Ajouter un employé', 'Modifier l’employé'], tasks: ['Créer une tâche', 'Modifier la tâche'], shifts: ['Ajouter un créneau', 'Modifier le créneau'], equipment: ['Ajouter un équipement', 'Modifier l’équipement'], stock: ['Ajouter un article', 'Modifier l’article'] };
 const input = (name: string, label: string, type = 'text', required = true, fallback = '', extra: Record<string, string | number> = {}) => <label className="field">{label}{!required && <span> (facultatif)</span>}<input name={name} type={type} required={required} defaultValue={values[name] ?? fallback} maxLength={type === 'text' ? 160 : undefined} {...extra}/></label>;
 const select = (name: string, label: string, options: { value: string; label: string }[], fallback = '') => <label className="field">{label}<select name={name} defaultValue={values[name] ?? fallback}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
 const opts = (list: string[]) => list.map(s => ({ value: s, label: s }));
 const submit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault(); if (submitting || !canWrite) return; setError(''); const fd = new FormData(event.currentTarget); const str = (key: string) => String(fd.get(key) || '').trim(); const num = (key: string) => Number(fd.get(key)); const id = item?.id || `new-${Date.now()}`; let record: Resource;
  if (kind === 'employees') { if (!str('name') || !str('skills')) { setError('Renseignez un nom et au moins une compétence.'); return; } record = { id, name: str('name'), role: selectedAccessRole === 'GESTIONNAIRE_FLOTTE' ? str('role') : item ? String(values.role) : roleLabels[selectedAccessRole as AccessRole] || '', status: str('status'), skills: str('skills'), load: num('load'), email: str('email'), phone: str('phone') }; }
  else if (kind === 'tasks') {
   if (!str('title') || !str('client') || !str('location')) { setError('Le titre, le client et le lieu sont obligatoires.'); return; }
   const task: Task = { progress: str('progress') || 'À faire', id, title: str('title'), client: str('client'), location: str('location'), date: str('date'), start: str('start'), end: str('end'), skill: str('skill'), employeeId: str('employeeId'), status: str('status') };
   if (task.start >= task.end) { setError('L’heure de fin doit être après l’heure de début.'); return; }
   if (task.status === 'Affectée') { const employee = store.employees.find(e => e.id === task.employeeId); if (!employee) { setError('Choisissez un employé pour confirmer l’affectation.'); return; } const issue = assignmentIssue(task, employee, store); if (issue) { setError(issue); return; } }
   else task.employeeId = '';
   record = task;
  } else if (kind === 'shifts') {
   const shift: Shift = { id, employeeId: str('employeeId'), date: str('date'), start: str('start'), end: str('end') };
   if (!shift.employeeId) { setError('Ajoutez d’abord un employé.'); return; }
   if (shift.start >= shift.end) { setError('L’heure de fin doit être après l’heure de début.'); return; }
   if (store.shifts.some(s => s.id !== id && s.employeeId === shift.employeeId && s.date === shift.date && s.start < shift.end && shift.start < s.end)) { setError('Ce créneau chevauche un autre horaire de cet employé.'); return; }
   record = shift;
  } else if (kind === 'equipment') { if (!str('name') || !str('assignment')) { setError('Renseignez le nom et l’affectation.'); return; } record = { id, name: str('name'), assignment: str('assignment'), status: str('status') }; }
  else { if (!str('name') || !str('unit')) { setError('Renseignez le nom et l’unité.'); return; } record = { id, name: str('name'), quantity: num('quantity'), minimum: num('minimum'), unit: str('unit') }; }
  setSubmitting(true);
  try { await save(kind, record, kind === 'employees' && !item ? str('accessRole') : undefined); } catch (error) { setError(error instanceof Error ? error.message : 'Enregistrement impossible.'); } finally { setSubmitting(false); }
 };
 return <Dialog close={close} title={names[kind][item ? 1 : 0]}><span className="modal-eyebrow">CODRIVE · GESTION DES RESSOURCES</span><h2 id="dialog-title">{names[kind][item ? 1 : 0]}</h2><p className="modal-subtitle">Les changements seront enregistrés dans MongoDB via l’API NestJS.</p><form onSubmit={submit}>
 {kind === 'employees' && <>{input('name', 'Nom complet')}{!item && <><label className="field">Rôle d’accès à l’application<select name="accessRole" required value={selectedAccessRole} onChange={e => setSelectedAccessRole(e.target.value)}><option value="">Choisir un rôle</option>{accessRoles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></label><p className="field-hint">Le métier est à préciser uniquement pour la gestion de flotte.</p></>}<div className="form-row">{selectedAccessRole === 'GESTIONNAIRE_FLOTTE' && select('role', 'Métier', opts(fleetJobs), fleetJobs[0])}{select('status', 'Statut', opts(employeeStatuses), 'Disponible')}</div>{input('skills', 'Compétences (séparées par des virgules)')}<p className="field-hint">Ex. : Permis B, Diagnostic OBD, Anglais. Utilisées pour les recommandations.</p>{input('load', 'Charge de travail déclarée (%)', 'number', true, '0', { min: 0, max: 100, step: 1 })}<div className="form-row">{input('email', 'E-mail du compte', 'email', true)}{input('phone', 'Téléphone', 'tel', false)}</div></>}
 {kind === 'tasks' && <>{input('title', 'Intitulé de la tâche')}<div className="form-row">{input('client', 'Client / véhicule')}{input('location', 'Lieu')}</div>{input('date', 'Date', 'date', true, today)}<div className="form-row">{input('start', 'Heure de début', 'time', true, '09:00')}{input('end', 'Heure de fin', 'time', true, '12:00')}</div><label className="field">Compétence requise<input name="skill" list="employee-skills" required maxLength={160} defaultValue={values.skill || ''} placeholder="Saisir une compétence"/><datalist id="employee-skills">{Array.from(new Set(store.employees.flatMap(e => e.skills.split(',').map(s => s.trim()).filter(Boolean)))).sort().map(skill => <option value={skill} key={skill}/>)}</datalist></label><div className="form-row">{select('status', 'Statut', opts(['Proposée', 'Affectée']), 'Proposée')}{select('progress', 'Avancement', opts(['À faire', 'En cours', 'Terminée']), 'À faire')}{select('employeeId', 'Employé (si affectée)', [{ value: '', label: 'Choisir un employé' }, ...store.employees.map(e => ({ value: e.id, label: e.name }))])}</div><p className="field-hint">Une tâche proposée reçoit une recommandation. Pour une affectation manuelle, choisissez « Affectée » et un employé compatible.</p></>}
 {kind === 'shifts' && <>{select('employeeId', 'Employé', [{ value: '', label: 'Choisir un employé' }, ...store.employees.map(e => ({ value: e.id, label: e.name }))])}{input('date', 'Date', 'date', true, today)}<div className="form-row">{input('start', 'Début', 'time', true, '08:00')}{input('end', 'Fin', 'time', true, '17:00')}</div><p className="field-hint">Sans créneau, un employé est considéré au repos. Supprimez ses créneaux pour libérer une journée.</p></>}
 {kind === 'equipment' && <>{input('name', 'Nom de l’équipement')}{input('assignment', 'Affecté à (employé ou lieu)')}{select('status', 'État', opts(equipmentStatuses), 'Opérationnel')}</>}
 {kind === 'stock' && <>{input('name', 'Nom de l’article')}<div className="form-row">{input('quantity', 'Quantité en stock', 'number', true, '0', { min: 0, step: 1 })}{input('minimum', 'Seuil minimum', 'number', true, '5', { min: 0, step: 1 })}</div>{input('unit', 'Unité', 'text', true, 'pièces')}<p className="field-hint">Une alerte apparaît lorsque la quantité est inférieure au seuil minimum.</p></>}
 {error && <div className="form-error" role="alert"><Icon name="alert" size={16}/>{error}</div>}<div className="modal-footer"><button type="button" className="btn ghost" onClick={close}>Annuler</button><button className="btn primary" type="submit" disabled={submitting || !canWrite}><Icon name="check" size={16}/>{submitting ? 'Enregistrement…' : item ? 'Enregistrer' : 'Créer'}</button></div></form></Dialog>;
}

