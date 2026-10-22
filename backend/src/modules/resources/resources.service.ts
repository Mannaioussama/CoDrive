import { accessRoles, fleetJobs, roleLabels, type AccessRole } from '../../../../lib/access';
import { AuthService } from '../auth/auth.service';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { assignmentIssue, overlaps, recommend, type Employee, type Kind, type Resource, type Shift, type Store, type Task } from '../../../../lib/resources';
import { validateDto } from './resource.dto';
type MongoModel = Model<Record<string, unknown>>;

@Injectable()
export class ResourcesService implements OnModuleInit {
 constructor(
  private readonly auth: AuthService,
  @InjectConnection() private readonly connection: Connection,
  @InjectModel('Employee') private readonly employees: MongoModel,
  @InjectModel('Task') private readonly tasks: MongoModel,
  @InjectModel('Shift') private readonly shifts: MongoModel,
  @InjectModel('Equipment') private readonly equipment: MongoModel,
  @InjectModel('Stock') private readonly stock: MongoModel,
  @InjectModel('Revision') private readonly revision: MongoModel,
 ) {}
 private get models(): Record<Kind, MongoModel> { return { employees: this.employees, tasks: this.tasks, shifts: this.shifts, equipment: this.equipment, stock: this.stock }; }
 async onModuleInit() {
  await Promise.all([...Object.values(this.models), this.revision].map(model => model.init()));
  await this.revision.updateOne({ _id: 'resources' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
 }
 async snapshot(session?: ClientSession): Promise<Store> {
  if (!session) return this.connection.transaction(s => this.snapshot(s), { readConcern: { level: 'snapshot' } });
  const entries: [string, unknown][] = [];
  for (const [kind, model] of Object.entries(this.models)) {
   entries.push([kind, await model.find().session(session).select('-_id -__v -createdAt -updatedAt').lean().exec()]);
  }
  return Object.fromEntries(entries) as Store;
 }
 async list(kind: Kind) { return (await this.snapshot())[kind]; }
 async find(kind: Kind, id: string) {
  const record = await this.models[kind].findOne({ id }).select('-_id -__v -createdAt -updatedAt').lean().exec();
  if (!record) throw new NotFoundException('Cette ressource n’existe plus.');
  return record;
 }
 private async transaction<T>(work: (session: ClientSession, store: Store) => Promise<T>): Promise<T> {
  return this.connection.transaction(async session => {
   await this.revision.updateOne({ _id: 'resources' }, { $inc: { revision: 1 } }, { session });
   return work(session, await this.snapshot(session));
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
 }
 private validateBusiness(kind: Kind, record: Resource, store: Store) {
  if (kind === 'tasks' || kind === 'shifts') {
   const timed = record as Task | Shift;
   const parsed = new Date(`${timed.date}T12:00:00Z`);
   if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== timed.date) throw new BadRequestException('La date indiquée est invalide.');
   if (timed.start >= timed.end) throw new BadRequestException('L’heure de fin doit être après l’heure de début.');
  }
  if (kind === 'tasks') {
   const task = record as Task;
   if (task.status === 'Proposée') task.employeeId = '';
   else {
    const employee = store.employees.find(e => e.id === task.employeeId);
    if (!employee) throw new BadRequestException('L’employé affecté n’existe pas.');
    const issue = assignmentIssue(task, employee, store);
    if (issue) throw new ConflictException(issue);
   }
  }
  if (kind === 'shifts') {
   const shift = record as Shift;
   if (!store.employees.some(e => e.id === shift.employeeId)) throw new BadRequestException('Cet employé n’existe pas.');
   if (store.shifts.some(s => s.id !== shift.id && s.employeeId === shift.employeeId && s.date === shift.date && overlaps(s, shift))) throw new ConflictException('Ce créneau chevauche un autre horaire de cet employé.');
   const next = { ...store, shifts: [...store.shifts.filter(s => s.id !== shift.id), shift] };
   this.assertCoverage(next);
  }
  if (kind === 'employees') {
   const employee = record as Employee;
   const assigned = store.tasks.filter(t => t.employeeId === employee.id && t.status === 'Affectée');
   if (assigned.length && (employee.status === 'Congé' || employee.load >= 100)) throw new ConflictException('Cet employé a des tâches affectées. Réaffectez-les avant de le rendre indisponible.');
   if (assigned.some(t => !employee.skills.split(',').map(s => s.trim().toLowerCase()).includes(t.skill.toLowerCase()))) throw new ConflictException('Une compétence est encore nécessaire à une tâche affectée.');
  }
 }
 private assertCoverage(store: Store) {
  if (store.tasks.some(t => t.status === 'Affectée' && !store.shifts.some(s => s.employeeId === t.employeeId && s.date === t.date && s.start <= t.start && s.end >= t.end))) throw new ConflictException('Une tâche affectée ne serait plus couverte par un créneau de travail. Réaffectez-la d’abord.');
 }
 async create(kind: Kind, body: unknown, accessRole?: AccessRole): Promise<Store> {
  if (kind === 'employees' && !accessRoles.includes(accessRole as AccessRole)) throw new BadRequestException('Choisissez un rôle d’accès pour cet employé.');
  const data = await validateDto(kind, body);
  if (kind === 'employees' && accessRole) {
   if (accessRole === 'GESTIONNAIRE_FLOTTE' ? !fleetJobs.includes(String(data.role)) : data.role !== roleLabels[accessRole]) throw new BadRequestException('Le métier ne correspond pas au rôle sélectionné.');
  }
  return this.transaction(async (session, store) => {
   const record = { ...data, id: randomUUID() } as Resource;
   this.validateBusiness(kind, record, store);
   if (kind === 'employees') await this.auth.syncEmployee(record.id, (record as Employee).email, session, accessRole);
   await this.models[kind].create([record], { session });
   return this.snapshot(session);
  });
 }
 async update(kind: Kind, id: string, body: unknown, partial = false): Promise<Store> {
  const changes = await validateDto(kind, body, partial);
  return this.transaction(async (session, store) => {
   const current = store[kind].find(record => record.id === id);
   if (!current) throw new NotFoundException('Cette ressource n’existe plus.');
   const { id: ignored, ...existing } = current;
   void ignored;
   const data = partial ? await validateDto(kind, { ...existing, ...changes }) : changes;
   const record = { ...data, id } as Resource;
   this.validateBusiness(kind, record, store);
   if (kind === 'employees') await this.auth.syncEmployee(id, (record as Employee).email, session);
   await this.models[kind].replaceOne({ id }, record, { session, runValidators: true });
   return this.snapshot(session);
  });
 }
 async remove(kind: Kind, id: string): Promise<Store> {
  return this.transaction(async (session, store) => {
   if (!store[kind].some(record => record.id === id)) throw new NotFoundException('Cette ressource n’existe plus.');
   if (kind === 'shifts') this.assertCoverage({ ...store, shifts: store.shifts.filter(s => s.id !== id) });
   await this.models[kind].deleteOne({ id }, { session });
   if (kind === 'employees') {
    await this.auth.removeEmployee(id, session);
    await this.tasks.updateMany({ employeeId: id }, { $set: { employeeId: '', status: 'Proposée' } }, { session });
    await this.shifts.deleteMany({ employeeId: id }, { session });
   }
   return this.snapshot(session);
  });
 }
 async assign(taskId: string) {
  return this.transaction(async (session, store) => {
   const task = store.tasks.find(t => t.id === taskId);
   if (!task) throw new NotFoundException('Cette tâche n’existe plus.');
   if (task.status === 'Affectée') throw new ConflictException('Cette tâche est déjà affectée.');
   const suggestion = recommend(task, store);
   if (!suggestion) throw new ConflictException('Aucun employé compatible et disponible pour cette tâche.');
   await this.tasks.updateOne({ id: taskId }, { $set: { employeeId: suggestion.employee.id, status: 'Affectée' } }, { session });
   return this.snapshot(session);
  });
 }
 async assignAll() {
  return this.transaction(async (session, store) => {
   let assigned = 0;
   for (const task of store.tasks) {
    if (task.status !== 'Proposée') continue;
    const suggestion = recommend(task, store);
    if (!suggestion) continue;
    task.employeeId = suggestion.employee.id; task.status = 'Affectée'; assigned++;
    await this.tasks.updateOne({ id: task.id }, { $set: { employeeId: task.employeeId, status: task.status } }, { session });
   }
   return { store: await this.snapshot(session), assigned, remaining: store.tasks.filter(t => t.status === 'Proposée').length };
  });
 }
 async health() { await this.connection.db?.admin().ping(); return { status: 'ok', database: this.connection.readyState === 1 ? 'connected' : 'disconnected' }; }
}
