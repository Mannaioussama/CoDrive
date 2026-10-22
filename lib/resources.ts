export type Employee = { id: string; name: string; role: string; status: string; skills: string; load: number; email: string; phone: string };
export type Task = { progress?: string; id: string; title: string; client: string; location: string; date: string; start: string; end: string; skill: string; employeeId: string; status: string };
export type Equipment = { id: string; name: string; assignment: string; status: string };
export type Stock = { id: string; name: string; quantity: number; minimum: number; unit: string };
export type Shift = { id: string; employeeId: string; date: string; start: string; end: string };
export type Store = { employees: Employee[]; tasks: Task[]; equipment: Equipment[]; stock: Stock[]; shifts: Shift[] };
export type Kind = keyof Store;
export type Resource = Employee | Task | Equipment | Stock | Shift;
export const roles = ['Gestionnaire de flotte', 'Mécanicien', 'Préparateur automobile', 'Agent de réservation', 'Agent de facturation', 'Comptabilité', 'Administrateur', 'Chargé de clientèle'];
export const employeeStatuses = ['Disponible', 'En mission', 'Congé'];
export const equipmentStatuses = ['Opérationnel', 'En révision', 'En prêt'];
export function initials(name: string) { return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join(''); }
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }) { return a.start < b.end && b.start < a.end; }
export function datesForWeek(week: string) { return Array.from({ length: 7 }, (_, i) => { const d = new Date(`${week}T12:00:00`); d.setDate(d.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }); }
export function moveWeek(week: string, offset: number) { const d = new Date(`${week}T12:00:00`); d.setDate(d.getDate() + offset * 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) { return new Intl.DateTimeFormat('fr-FR', options).format(new Date(`${date}T12:00:00`)); }
export function duration(task: Task) { const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)); const d = mins(task.end) - mins(task.start); return `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}`; }
export function assignmentIssue(task: Task, employee: Employee, store: Store): string | null {
 if (employee.status === 'Congé') return 'Cet employé est en congé.';
 if (!employee.skills.toLowerCase().split(',').map(s => s.trim()).includes(task.skill.toLowerCase())) return `Compétence requise manquante : ${task.skill}.`;
 if (!store.shifts.some(s => s.employeeId === employee.id && s.date === task.date && s.start <= task.start && s.end >= task.end)) return 'Aucun créneau disponible couvrant toute la tâche. Modifiez les horaires.';
 if (store.tasks.some(t => t.id !== task.id && t.status === 'Affectée' && t.employeeId === employee.id && t.date === task.date && overlaps(t, task))) return 'Cet employé a déjà une mission sur ce créneau.';
 if (employee.load >= 100) return 'La charge de travail de cet employé atteint 100 %.';
 return null;
}
export function recommend(task: Task, store: Store) {
 return store.employees.filter(e => !assignmentIssue(task, e, store)).map(employee => ({ employee, score: Math.round(100 - employee.load * .16), reason: `${task.skill} · créneau disponible · charge ${employee.load} %` })).sort((a, b) => b.score - a.score)[0] ?? null;
}
export function conflictsFor(employeeId: string, date: string, store: Store) {
 const tasks = store.tasks.filter(t => t.employeeId === employeeId && t.date === date && t.status === 'Affectée');
 const shifts = store.shifts.filter(s => s.employeeId === employeeId && s.date === date);
 return tasks.some((t, i) => tasks.slice(i + 1).some(other => overlaps(t, other))) || shifts.some((s, i) => shifts.slice(i + 1).some(other => overlaps(s, other)));
}

export function localDate(date: Date): string {
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function startOfWeek(date: string): string {
 const value = new Date(`${date}T12:00:00`);
 value.setDate(value.getDate() - (value.getDay() + 6) % 7);
 return localDate(value);
}
export function resourceNeeds(store: Store, from: string, to: string) {
 const uncovered = new Map<string, number>();
 for (const task of store.tasks) {
  if (task.status === 'Proposée' && task.date >= from && task.date <= to && !recommend(task, store)) uncovered.set(task.skill, (uncovered.get(task.skill) || 0) + 1);
 }
 return {
  uncovered: [...uncovered].map(([skill, count]) => ({ skill, count })),
  overloaded: store.employees.filter(employee => employee.load > 80),
  lowStock: store.stock.filter(stock => stock.quantity < stock.minimum),
 };
}
