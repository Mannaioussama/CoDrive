import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from './fixtures/resources.mjs';
import { planDemoCleanup } from '../scripts/demo-cleanup-plan.mjs';
test('demo cleanup removes only unchanged sample records', () => {
 const store = structuredClone(seed);
 store.employees[0].name = 'Real edited employee';
 store.stock.push({ id: 'custom-stock', name: 'New stock', quantity: 1, minimum: 2, unit: 'items' });
 const plan = planDemoCleanup(store, seed);
 assert.ok(!plan.employees.includes('e1'));
 assert.ok(!plan.stock.includes('custom-stock'));
 assert.equal(plan.tasks.length, seed.tasks.length);
});
test('demo cleanup preserves employees and schedules used by user tasks', () => {
 const store = structuredClone(seed);
 store.tasks.push({ ...store.tasks[0], id: 'user-task', employeeId: 'e3', status: 'Affectée' });
 const plan = planDemoCleanup(store, seed);
 assert.ok(!plan.employees.includes('e3'));
 assert.ok(!plan.shifts.includes('h2-0'));
 assert.ok(!plan.tasks.includes('user-task'));
});
