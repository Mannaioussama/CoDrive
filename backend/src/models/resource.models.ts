import { Schema } from 'mongoose';
import { employeeStatuses, equipmentStatuses, roles } from '../../../lib/resources';
const id = { type: String, required: true, unique: true, immutable: true, maxlength: 100 };
const text = { type: String, required: true, trim: true, maxlength: 160 };
const options = { timestamps: true, strict: 'throw' as const };
export const EmployeeSchema = new Schema({ id, name: text, role: { type: String, enum: roles, required: true }, status: { type: String, enum: employeeStatuses, required: true }, skills: { ...text, maxlength: 500 }, load: { type: Number, required: true, min: 0, max: 100 }, email: { type: String, default: '', maxlength: 254 }, phone: { type: String, default: '', maxlength: 40 } }, options);
export const TaskSchema = new Schema({ progress: { type: String, enum: ['À faire', 'En cours', 'Terminée'], default: 'À faire' }, id, title: text, client: text, location: text, date: text, start: text, end: text, skill: text, employeeId: { type: String, default: '', index: true }, status: { type: String, enum: ['Proposée', 'Affectée'], required: true } }, options);
TaskSchema.index({ employeeId: 1, date: 1, status: 1 });
export const ShiftSchema = new Schema({ id, employeeId: { ...text, index: true }, date: text, start: text, end: text }, options);
ShiftSchema.index({ employeeId: 1, date: 1 });
export const EquipmentSchema = new Schema({ id, name: text, assignment: text, status: { type: String, enum: equipmentStatuses, required: true } }, options);
export const StockSchema = new Schema({ id, name: text, quantity: { type: Number, required: true, min: 0 }, minimum: { type: Number, required: true, min: 0 }, unit: { ...text, maxlength: 40 } }, options);
// A transaction updates this document before reading the resource collections.
// Concurrent planners contend on this write, so a retry sees the latest assignments.
export const RevisionSchema = new Schema({ _id: String, revision: { type: Number, default: 0 } }, { versionKey: false });
export const modelDefinitions = [
 { name: 'Employee', schema: EmployeeSchema, collection: 'employees' },
 { name: 'Task', schema: TaskSchema, collection: 'tasks' },
 { name: 'Shift', schema: ShiftSchema, collection: 'shifts' },
 { name: 'Equipment', schema: EquipmentSchema, collection: 'equipment' },
 { name: 'Stock', schema: StockSchema, collection: 'stock' },
 { name: 'Revision', schema: RevisionSchema, collection: 'resource_revisions' },
];
