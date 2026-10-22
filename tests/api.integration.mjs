import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';

// Each run owns a fresh database. Existing FleetPro records are never touched.
test('API NestJS + MongoDB : CRUD, validation, transactions et persistance', { timeout: 60000 }, async t => {
 const name = `fleetpro_test_${randomUUID().replaceAll('-', '')}`;
 const mongoUrl = new URL(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27018/?replicaSet=fleetpro-rs');
 mongoUrl.pathname = `/${name}`;
 const port = Number(process.env.API_TEST_PORT || 4011);
 const base = `http://127.0.0.1:${port}/api`;
 const mongo = new mongoose.mongo.MongoClient(mongoUrl.href, { serverSelectionTimeoutMS: 5000 });
 await mongo.connect();
 await mongo.db(name).collection('auth_users').insertOne({ _id: 'admin', email: 'admin@example.com', salt: 'test-salt', hash: scryptSync('test-password-2026', 'test-salt', 64).toString('hex'), role: 'ADMIN', active: true });
 let logs = '';
 const server = spawn(process.execPath, ['backend/dist/backend/src/main.js'], { env: { ...process.env, MONGODB_URI: mongoUrl.href, PORT: String(port), HOST: '127.0.0.1', SMTP_HOST: '', SMTP_FROM: '', APP_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
 server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
 t.after(async () => {
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  assert.match(name, /^fleetpro_test_[a-f0-9]{32}$/);
  await mongo.db(name).dropDatabase();
  await mongo.close();
 });
 for (let attempt = 0; ; attempt++) {
  try { const response = await fetch(`${base}/auth/status`); if (response.ok) break; } catch {}
  if (attempt >= 100 || server.exitCode !== null) throw new Error(`L’API de test ne démarre pas : ${logs}`);
  await new Promise(resolve => setTimeout(resolve, 200));
 }
 let cookie = '';
 const request = async (method, path, data, status = 200) => {
  const response = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body)); return body;
 };
 await t.test('authentification : création unique, protection, cookie et révocation', async () => {
  await request('GET', '/resources', undefined, 401);
  await request('GET', '/settings', undefined, 401);
  assert.equal((await request('GET', '/auth/status')).registrationOpen, false);
  await request('POST', '/auth/setup', { email: 'stranger@example.com', password: 'test-password-2026' }, 403);
  await request('POST', '/auth/login', { email: 'admin@example.com', password: 'test-password-2026' }, 201);
  assert.match(cookie, /^codrive_session=[a-f0-9]{64}$/);
  assert.equal((await request('GET', '/auth/me')).email, 'admin@example.com');
  assert.equal((await request('GET', '/auth/status')).setupRequired, false);
  await request('POST', '/auth/setup', { email: 'other@example.com', password: 'test-password-2026' }, 403);
  const old = cookie;
  await request('POST', '/auth/logout', undefined, 201);
  cookie = old;
  await request('GET', '/auth/me', undefined, 401);
  await request('GET', '/resources', undefined, 401);
  await request('POST', '/auth/login', { email: 'admin@example.com', password: 'wrong-password' }, 401);
  await request('POST', '/auth/login', { email: 'admin@example.com', password: 'test-password-2026' }, 201);
  const blocked = await fetch(`${base}/resources/employees`, { method: 'POST', headers: { Cookie: cookie, Origin: 'https://untrusted.example' } });
  assert.equal(blocked.status, 403);
  const user = await mongo.db(name).collection('auth_users').findOne({ _id: 'admin' });
  assert.equal(user.password, undefined); assert.notEqual(user.hash, 'test-password-2026');
 });
 await t.test('une nouvelle base démarre vide sans données préchargées', async () => {
  const store = await request('GET', '/resources');
  for (const rows of Object.values(store)) assert.deepEqual(rows, []);
 });
 await t.test('personnalisation : thème, identité, logo, couleurs et tableau de bord persistés', async () => {
  const defaults = await request('GET', '/settings');
  assert.equal(defaults.agencyName, '');
  const logo = await readFile('public/icon-192.png');
  const data = { agencyName: 'Agence de test', logoDataUrl: `data:image/png;base64,${logo.toString('base64')}`, theme: 'dark', primaryColor: '#7554c9', accentColor: '#d49c54', dashboardType: 'analytical' };
  assert.deepEqual(await request('PUT', '/settings', data), data);
  assert.deepEqual(await request('GET', '/settings'), data);
  const saved = await mongo.db(name).collection('workspace_settings').findOne({ _id: 'agency' });
  assert.equal(saved.agencyName, data.agencyName); assert.equal(saved.logoDataUrl, data.logoDataUrl);
  await request('PUT', '/settings', { ...data, theme: 'unknown' }, 400);
  await request('PUT', '/settings', { ...data, primaryColor: 'red;display:none' }, 400);
  await request('PUT', '/settings', { ...data, dashboardType: 'fake' }, 400);
  await request('PUT', '/settings', { ...data, dashboardType: 'compact' }, 400);
  await request('PUT', '/settings', { ...data, logoDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }, 400);
  await request('PUT', '/settings', { ...data, logoDataUrl: 'data:image/png;base64,aGVsbG8=' }, 400);
  await request('PUT', '/settings', { ...data, admin: true }, 400);
  assert.deepEqual(await request('GET', '/settings'), data);
  for (const dashboardType of ['analytical', 'operational', 'intelligent']) {
   const saved = await request('PUT', '/settings', { ...data, dashboardType });
   assert.equal(saved.dashboardType, dashboardType);
   assert.equal((await request('GET', '/settings')).dashboardType, dashboardType);
  }
  await mongo.db(name).collection('workspace_settings').updateOne({ _id: 'agency' }, { $set: { dashboardType: 'compact' } });
  assert.equal((await request('GET', '/settings')).dashboardType, 'intelligent');
  assert.deepEqual(await request('PUT', '/settings', defaults), defaults);
 });
 await t.test('métiers conditionnels : deux métiers flotte et intitulé automatique des autres rôles', async () => {
  const baseEmployee = { name: 'Test métier', status: 'Disponible', skills: 'Organisation', load: 0, phone: '' };
  let index = 0;
  for (const [accessRole, role] of [['GESTIONNAIRE_FLOTTE', 'Mécanicien'], ['GESTIONNAIRE_FLOTTE', 'Préparateur automobile'], ['AGENT_RESERVATION', 'Agent de réservation'], ['AGENT_FACTURATION', 'Comptabilité'], ['ADMIN', 'Administrateur'], ['CHARGE_CLIENTELE', 'Chargé de clientèle']]) {
   const store = await request('POST', '/resources/employees', { ...baseEmployee, email: `job${index++}@example.com`, accessRole, role }, 201);
   const created = store.employees.find(e => e.name === baseEmployee.name);
   assert.equal(created.role, role);
   await request('DELETE', `/resources/employees/${created.id}`);
  }
  await request('POST', '/resources/employees', { ...baseEmployee, email: 'bad-job@example.com', accessRole: 'AGENT_RESERVATION', role: 'Mécanicien' }, 400);
  await request('POST', '/resources/employees', { ...baseEmployee, email: 'bad-role@example.com', accessRole: 'MECANICIEN', role: 'Mécanicien' }, 400);
 });
 let employeeId, shiftId, taskId;
 const employee = { name: 'Test API', role: 'Mécanicien', status: 'Disponible', skills: 'Permis B', load: 25, email: 'employee@example.com', phone: '', accessRole: 'GESTIONNAIRE_FLOTTE' };
 await t.test('création, lecture, remplacement et modification partielle d’un employé', async () => {
  let store = await request('POST', '/resources/employees', employee, 201);
  employeeId = store.employees[0].id;
  assert.equal((await request('GET', `/resources/employees/${employeeId}`)).name, employee.name);
  store = await request('PUT', `/resources/employees/${employeeId}`, Object.fromEntries(Object.entries({ ...employee, name: 'Test modifié' }).filter(([key]) => key !== 'accessRole')));
  assert.equal(store.employees[0].name, 'Test modifié');
  store = await request('PATCH', `/resources/employees/${employeeId}`, { load: 30 });
  assert.equal(store.employees[0].load, 30);
  assert.equal((await request('GET', '/resources/employees')).length, 1);
 });
 await t.test('refus des champs inconnus, quantités négatives et champs obligatoires', async () => {
  await request('POST', '/resources/employees', { ...employee, admin: true }, 400);
  await request('PATCH', `/resources/employees/${employeeId}`, { load: 101 }, 400);
  await request('POST', '/resources/stock', { name: 'Huile', quantity: -1, minimum: 2, unit: 'L' }, 400);
  await request('POST', '/resources/equipment', {}, 400);
  await request('GET', '/resources/unknown', undefined, 400);
  await request('GET', '/resources/employees/not-found', undefined, 404);
 });
 await t.test('CRUD des créneaux et rejet des chevauchements / dates impossibles', async () => {
  const shift = { employeeId, date: '2030-01-02', start: '08:00', end: '18:00' };
  let store = await request('POST', '/resources/shifts', shift, 201); shiftId = store.shifts[0].id;
  await request('POST', '/resources/shifts', shift, 409);
  await request('POST', '/resources/shifts', { ...shift, date: '2030-02-30' }, 400);
  await request('POST', '/resources/shifts', { ...shift, date: '2030-01-03', start: '18:00', end: '08:00' }, 400);
  store = await request('PUT', `/resources/shifts/${shiftId}`, { ...shift, end: '17:00' });
  assert.equal(store.shifts[0].end, '17:00');
 });
 const task = { title: 'Livraison de test', client: 'Client Test', location: 'Tunis', date: '2030-01-02', start: '09:00', end: '11:00', skill: 'Permis B', employeeId: '', status: 'Proposée' };
 await t.test('création des tâches et affectations concurrentes sans double réservation', async () => {
  let store = await request('POST', '/resources/tasks', task, 201); taskId = store.tasks[0].id;
  store = await request('POST', '/resources/tasks', { ...task, title: 'Deuxième mission' }, 201);
  const secondId = store.tasks.find(row => row.id !== taskId).id;
  const responses = await Promise.all([taskId, secondId].map(id => fetch(`${base}/assignments/${id}`, { method: 'POST', headers: { Cookie: cookie } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  store = await request('GET', '/resources');
  assert.equal(store.tasks.filter(t => t.status === 'Affectée').length, 1);
  await request('DELETE', `/resources/shifts/${shiftId}`, undefined, 409);
  await request('POST', '/resources/tasks', { ...task, title: 'Incompatible', skill: 'Freinage', employeeId, status: 'Affectée' }, 409);
 });
 await t.test('affectation automatique et modification d’une tâche', async () => {
  let store = await request('POST', '/resources/tasks', { ...task, title: 'Mission après-midi', start: '13:00', end: '14:00' }, 201);
  const id = store.tasks.find(t => t.title === 'Mission après-midi').id;
  store = await request('PATCH', `/resources/tasks/${id}`, { title: 'Mission mise à jour' });
  assert.equal(store.tasks.find(t => t.id === id).title, 'Mission mise à jour');
  const result = await request('POST', '/assignments/auto', undefined, 201);
  assert.equal(result.assigned, 1); assert.equal(result.remaining, 1);
 });
 await t.test('CRUD équipements et pièces, seuils et valeurs persistées', async () => {
  for (const [kind, data, changes] of [
   ['equipment', { name: 'Valise de test', assignment: 'Atelier', status: 'Opérationnel' }, { status: 'En révision' }],
   ['stock', { name: 'Plaquettes de test', quantity: 4, minimum: 10, unit: 'jeux' }, { quantity: 20 }],
  ]) {
   let store = await request('POST', `/resources/${kind}`, data, 201); const id = store[kind][0].id;
   store = await request('PATCH', `/resources/${kind}/${id}`, changes);
   for (const [key, value] of Object.entries(changes)) assert.equal(store[kind][0][key], value);
   const persisted = await mongo.db(name).collection(kind).findOne({ id });
   assert.ok(persisted?._id); assert.equal(persisted.name, data.name);
   store = await request('DELETE', `/resources/${kind}/${id}`); assert.equal(store[kind].length, 0);
   await request('DELETE', `/resources/${kind}/${id}`, undefined, 404);
  }
 });
 await t.test('suppression d’un employé : cascade atomique sur horaires et affectations', async () => {
  const store = await request('DELETE', `/resources/employees/${employeeId}`);
  assert.equal(store.employees.length, 0); assert.equal(store.shifts.length, 0);
  assert.ok(store.tasks.every(t => t.employeeId === '' && t.status === 'Proposée'));
  assert.equal(await mongo.db(name).collection('employees').countDocuments(), 0);
  assert.equal(await mongo.db(name).collection('shifts').countDocuments(), 0);
  assert.equal(await mongo.db(name).collection('tasks').countDocuments({ status: 'Affectée' }), 0);
  const next = await request('DELETE', `/resources/tasks/${taskId}`); assert.equal(next.tasks.length, 2);
 });
 await t.test('invitations : activation unique, isolation des tâches, rôles et désactivation', async () => {
  const adminCookie = cookie;
  let store = await request('POST', '/resources/employees', { ...employee, email: 'invited@example.com' }, 201);
  const invited = store.employees[0];
  assert.equal(store.invitation.emailSent, false);
  let token = new URL(store.invitation.activationPath, base).searchParams.get('activation');
  const account = await mongo.db(name).collection('auth_users').findOne({ employeeId: invited.id });
  assert.equal(account.role, 'GESTIONNAIRE_FLOTTE'); assert.notEqual(account.activationHash, token); assert.equal(account.hash, undefined);
  await request('POST', '/auth/login', { email: invited.email, password: 'employee-password' }, 401);
  await mongo.db(name).collection('auth_users').updateOne({ employeeId: invited.id }, { $set: { activationExpires: new Date(0) } });
  await request('POST', '/auth/activate', { token, password: 'employee-password' }, 400);
  const replacement = await request('POST', `/accounts/${invited.id}/invite`, undefined, 201);
  await request('POST', '/auth/activate', { token, password: 'employee-password' }, 400);
  token = new URL(replacement.activationPath, base).searchParams.get('activation');
  await request('POST', '/auth/activate', { token, password: 'employee-password' }, 201);
  await request('POST', '/auth/activate', { token, password: 'employee-password' }, 400);
  await request('POST', '/resources/shifts', { employeeId: invited.id, date: '2030-02-02', start: '08:00', end: '17:00' }, 201);
  store = await request('POST', '/resources/tasks', { ...task, date: '2030-02-02', status: 'Affectée', employeeId: invited.id }, 201);
  const own = store.tasks.find(t => t.employeeId === invited.id);
  await request('POST', '/auth/login', { email: invited.email, password: 'employee-password' }, 201);
  const employeeCookie = cookie;
  assert.equal((await request('GET', '/auth/me')).role, 'GESTIONNAIRE_FLOTTE');
  await request('GET', '/resources', undefined, 200); await request('GET', '/accounts', undefined, 403); await request('GET', '/settings', undefined, 200);
  await request('DELETE', `/resources/employees/${invited.id}`, undefined, 403);
  const personal = await request('GET', '/me/tasks'); assert.equal(personal.tasks.length, 1); assert.equal(personal.tasks[0].id, own.id);
  await request('PATCH', `/me/tasks/${own.id}`, { progress: 'Terminée' });
  await request('PATCH', '/me/tasks/not-owned', { progress: 'Terminée' }, 404);
  cookie = adminCookie;
  assert.equal((await request('GET', '/resources')).tasks.find(t => t.id === own.id).progress, 'Terminée');
  await request('PATCH', `/accounts/${invited.id}`, { role: 'RESPONSABLE_RESSOURCES' }, 400);
  await request('PATCH', `/accounts/${invited.id}`, { role: 'EMPLOYE' }, 400);
  for (const role of ['AGENT_RESERVATION', 'GESTIONNAIRE_FLOTTE', 'AGENT_FACTURATION', 'CHARGE_CLIENTELE']) {
   await request('PATCH', `/accounts/${invited.id}`, { role });
   await request('POST', '/auth/login', { email: invited.email, password: 'employee-password' }, 201);
   assert.equal((await request('GET', '/auth/me')).role, role);
   await request('GET', '/settings', undefined, 200); await request('PATCH', `/accounts/${invited.id}`, { role: 'ADMIN' }, 403);
   await request('GET', '/resources', undefined, 200);
   await request('POST', '/resources/stock', { name: 'Interdit', quantity: 1, minimum: 1, unit: 'pièce' }, 403);
   await request('POST', '/assignments/auto', undefined, 403);
   await request('PUT', '/settings', {}, 403);
   cookie = adminCookie;
  }
  await request('PATCH', `/accounts/${invited.id}`, { active: false });
  cookie = employeeCookie; await request('GET', '/me/tasks', undefined, 401);
  await request('POST', '/auth/login', { email: invited.email, password: 'employee-password' }, 401);
  cookie = adminCookie;
  await request('PATCH', `/accounts/${invited.id}`, { active: true });
  await request('POST', '/auth/login', { email: invited.email, password: 'employee-password' }, 201);
  const activeCookie = cookie; cookie = adminCookie;
  await request('DELETE', `/resources/employees/${invited.id}`);
  cookie = activeCookie; await request('GET', '/me/tasks', undefined, 401); cookie = adminCookie;
 });
 await t.test('les réponses de l’API ne doivent pas être mises en cache', async () => {
  const response = await fetch(`${base}/resources`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
 });
});
