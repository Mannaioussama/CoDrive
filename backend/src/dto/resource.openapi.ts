import type { ApiBodyOptions } from '@nestjs/swagger';
import { employeeStatuses, equipmentStatuses, roles } from '../../../lib/resources';
const text = { type: 'string' as const, minLength: 1, maxLength: 160 };
const date = { type: 'string' as const, format: 'date' };
const time = { type: 'string' as const, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const employeeId = { type: 'string' as const, maxLength: 100 };
export const resourceBody: ApiBodyOptions = {
 description: 'Choisir le schéma correspondant à :kind. POST et PUT exigent les champs obligatoires. PATCH accepte uniquement les champs à modifier. L’identifiant id est généré par le serveur. Aucun enregistrement exemple n’est ajouté à la base.',
 schema: { oneOf: [
  { title: 'employees', type: 'object', additionalProperties: false, required: ['name', 'role', 'status', 'skills', 'load', 'email', 'phone'], properties: {
   name: text, role: { type: 'string', enum: roles }, status: { type: 'string', enum: employeeStatuses }, skills: { ...text, maxLength: 500 }, load: { type: 'integer', minimum: 0, maximum: 100 }, email: { type: 'string', maxLength: 254, description: 'Adresse e-mail valide ou chaîne vide.' }, phone: { type: 'string', maxLength: 40 },
  } },
  { title: 'tasks', type: 'object', additionalProperties: false, required: ['title', 'client', 'location', 'date', 'start', 'end', 'skill', 'employeeId', 'status'], properties: {
   title: text, client: text, location: text, date, start: time, end: time, skill: text, employeeId, status: { type: 'string', enum: ['Proposée', 'Affectée'] },
  } },
  { title: 'shifts', type: 'object', additionalProperties: false, required: ['employeeId', 'date', 'start', 'end'], properties: { employeeId: { ...employeeId, minLength: 1 }, date, start: time, end: time } },
  { title: 'equipment', type: 'object', additionalProperties: false, required: ['name', 'assignment', 'status'], properties: { name: text, assignment: text, status: { type: 'string', enum: equipmentStatuses } } },
  { title: 'stock', type: 'object', additionalProperties: false, required: ['name', 'quantity', 'minimum', 'unit'], properties: { name: text, quantity: { type: 'integer', minimum: 0, maximum: 1000000000 }, minimum: { type: 'integer', minimum: 0, maximum: 1000000000 }, unit: { ...text, maxLength: 40 } } },
 ] },
};
