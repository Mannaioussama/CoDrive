// Remove only unchanged legacy demo records, never edited records or their dependencies.
export function planDemoCleanup(store, fixture) {
 const removals = Object.fromEntries(Object.keys(fixture).map(kind => [kind, new Set(fixture[kind].filter(expected => store[kind].some(actual => actual.id === expected.id && Object.entries(expected).every(([key, value]) => actual[key] === value))).map(row => row.id))]));
 const retainedTasks = store.tasks.filter(task => !removals.tasks.has(task.id));
 for (const shift of store.shifts) {
  if (retainedTasks.some(task => task.status === 'Affectée' && task.employeeId === shift.employeeId && task.date === shift.date && shift.start <= task.start && shift.end >= task.end)) removals.shifts.delete(shift.id);
 }
 const retainedShifts = store.shifts.filter(shift => !removals.shifts.has(shift.id));
 for (const employee of store.employees) {
  if (retainedTasks.some(task => task.employeeId === employee.id) || retainedShifts.some(shift => shift.employeeId === employee.id)) removals.employees.delete(employee.id);
 }
 return Object.fromEntries(Object.entries(removals).map(([kind, ids]) => [kind, [...ids]]));
}
