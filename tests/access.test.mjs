import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessRoles, managementModules, canManage } from '../lib/access.ts';
test('permissions : admin modifie tout, chaque autre rôle modifie seulement sa gestion', () => {
 const expected = { GESTIONNAIRE_FLOTTE: 'vehicles', AGENT_RESERVATION: 'reservations', AGENT_FACTURATION: 'billing', CHARGE_CLIENTELE: 'complaints' };
 for (const role of accessRoles) for (const management of managementModules) assert.equal(canManage(role, management), role === 'ADMIN' || expected[role] === management, `${role}: ${management}`);
});
