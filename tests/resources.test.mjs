import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from './fixtures/resources.mjs';
import { localDate, startOfWeek, resourceNeeds, recommend, assignmentIssue, conflictsFor, datesForWeek, moveWeek } from '../lib/resources.ts';

test('recommandations : compétence, congé, disponibilité et charge', () => {
 const store = structuredClone(seed);
 const task = store.tasks[0];
 assert.equal(recommend(task, store).employee.id, 'e3');
 store.employees.find(e => e.id === 'e3').status = 'Congé';
 assert.equal(recommend(task, store).employee.id, 'e2');
 store.employees.find(e => e.id === 'e2').load = 100;
 assert.equal(recommend(task, store).employee.id, 'e1');
 store.shifts = [];
 assert.equal(recommend(task, store), null);
});
test('une affectation simultanée écarte le candidat, une mission contiguë reste autorisée', () => {
 const store = structuredClone(seed);
 store.tasks[0].status = 'Affectée'; store.tasks[0].employeeId = 'e3';
 const task = { ...store.tasks[0], id: 'new', start: '10:00', end: '11:00', status: 'Proposée' };
 assert.match(assignmentIssue(task, store.employees[2], store), /déjà une mission/);
 assert.notEqual(recommend(task, store).employee.id, 'e3');
 assert.equal(assignmentIssue({ ...task, start: '12:00', end: '13:00' }, store.employees[2], store), null);
});
test('un conflit disparaît après réaffectation', () => {
 const store = structuredClone(seed);
 assert.equal(conflictsFor('e1', '2026-10-29', store), true);
 store.tasks.find(t => t.id === 't6').employeeId = 'e2';
 assert.equal(conflictsFor('e1', '2026-10-29', store), false);
});
test('l’affectation en lot ne crée pas de nouveau chevauchement', () => {
 const store = structuredClone(seed);
 store.tasks.push({ ...store.tasks[0], id: 'simultaneous' });
 for (const t of store.tasks) {
  if (t.status !== 'Proposée') continue;
  const result = recommend(t, store);
  if (result) { t.employeeId = result.employee.id; t.status = 'Affectée'; }
 }
 assert.notEqual(store.tasks[0].employeeId, store.tasks.at(-1).employeeId);
 assert.equal(store.tasks.filter(t => t.status === 'Proposée').length, 0);
});
test('planning : la navigation traverse les mois et les années', () => {
 assert.equal(datesForWeek('2026-10-26').at(-1), '2026-11-01');
 assert.equal(moveWeek('2026-12-28', 1), '2027-01-04');
 assert.equal(moveWeek('2026-10-26', -1), '2026-10-19');
});
test('le planning démarre le lundi de la date courante, y compris en début d’année', () => {
 assert.equal(startOfWeek('2027-01-01'), '2026-12-28');
 assert.equal(startOfWeek('2026-10-20'), '2026-10-19');
 assert.equal(localDate(new Date(2030, 0, 2, 12)), '2030-01-02');
});
test('les besoins sont vides sans données et changent avec les tâches, horaires et stocks', () => {
 const empty = { employees: [], tasks: [], shifts: [], equipment: [], stock: [] };
 assert.deepEqual(resourceNeeds(empty, '2030-01-01', '2030-01-07'), { uncovered: [], overloaded: [], lowStock: [] });
 const store = structuredClone(seed);
 store.tasks = [{ ...store.tasks[0], date: '2030-01-02', skill: 'Custom skill' }, { ...store.tasks[0], id: 'outside-window', date: '2030-02-01' }];
 let needs = resourceNeeds(store, '2030-01-01', '2030-01-07');
 assert.deepEqual(needs.uncovered, [{ skill: 'Custom skill', count: 1 }]);
 assert.equal(needs.overloaded[0].id, 'e1');
 assert.equal(needs.lowStock[0].id, 's1');
 store.employees[2].skills = 'Custom skill';
 store.shifts.push({ id: 'new', employeeId: 'e3', date: '2030-01-02', start: '08:00', end: '18:00' });
 store.stock[0].quantity = 15;
 store.employees[0].load = 60;
 needs = resourceNeeds(store, '2030-01-01', '2030-01-07');
 assert.deepEqual(needs.uncovered, []);
 assert.deepEqual(needs.overloaded, []);
 assert.deepEqual(needs.lowStock, []);
});
