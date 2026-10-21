import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { createTransport } from 'nodemailer';
import { accessRoles, type AuthUser, type AccessRole } from '../../../lib/access';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const tokenFrom = (req: Request) => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('codrive_session='))?.slice(16);
@Injectable()
export class AuthService implements OnModuleInit {
 constructor(@InjectConnection() private readonly db: Connection) {}
 private attempts = new Map<string, { count: number; until: number }>();
 async onModuleInit() {
  await this.db.collection('auth_users').updateOne({ _id: 'admin' as never }, { $set: { role: 'ADMIN', active: true } });
  await this.db.collection('auth_users').createIndex({ email: 1 }, { unique: true });
  await this.db.collection('auth_sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
 }
 async status() { return { setupRequired: false, registrationOpen: false }; }
 async user(req: Request): Promise<AuthUser | null> {
  const token = tokenFrom(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await this.db.collection('auth_sessions').findOne({ _id: digest(token) as never, expires: { $gt: new Date() } });
  if (!session) return null;
  const user = await this.db.collection('auth_users').findOne(session.userId ? { _id: session.userId } : { email: session.email });
  if (!user || !user.active || !user.hash || !accessRoles.includes(user.role)) return null;
  return { id: String(user._id), email: user.email, role: user.role, ...(user.employeeId ? { employeeId: user.employeeId } : {}) };
 }
 private limit(req: Request) {
  const key = req.ip || 'local', now = Date.now();
  for (const [k, v] of this.attempts) if (v.until < now) this.attempts.delete(k);
  const entry = this.attempts.get(key);
  if (entry && entry.count >= 10) throw new ForbiddenException('Trop de tentatives. Réessayez dans 15 minutes.');
  this.attempts.set(key, { count: (entry?.count || 0) + 1, until: entry?.until || now + 900000 });
 }
 private password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new BadRequestException('Mot de passe de 8 à 128 caractères requis.');
  return value;
 }
 async login(body: unknown, req: Request, res: Response) {
  this.limit(req); const value = body as Record<string, unknown>;
  const password = this.password(value?.password);
  if (typeof value.email !== 'string' || value.email.length > 254) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
  const user = await this.db.collection('auth_users').findOne({ email: value.email.trim().toLowerCase() });
  const computed = scryptSync(password, user?.salt || 'invalid', 64);
  if (!user?.active || !user.hash || !accessRoles.includes(user.role) || !timingSafeEqual(computed, Buffer.from(user.hash, 'hex'))) throw new UnauthorizedException('E-mail ou mot de passe incorrect, ou compte non autorisé.');
  this.attempts.delete(req.ip || 'local');
  const token = randomBytes(32).toString('hex');
  await this.db.collection('auth_sessions').insertOne({ _id: digest(token) as never, userId: user._id, email: user.email, expires: new Date(Date.now() + 86400000) });
  res.cookie('codrive_session', token, { httpOnly: true, sameSite: 'lax', secure: req.secure || req.headers['x-forwarded-proto'] === 'https', maxAge: 86400000, path: '/' });
  return { id: String(user._id), email: user.email, role: user.role, ...(user.employeeId ? { employeeId: user.employeeId } : {}) };
 }
 async logout(req: Request, res: Response) {
  const token = tokenFrom(req);
  if (token) await this.db.collection('auth_sessions').deleteOne({ _id: digest(token) as never });
  res.clearCookie('codrive_session', { path: '/', httpOnly: true, sameSite: 'lax' }); return { ok: true };
 }
 async syncEmployee(id: string, email: string, session: ClientSession, role?: AccessRole) {
  if (!email) throw new BadRequestException('Un e-mail est requis pour le compte employé.');
  const users = this.db.collection('auth_users'), key = `employee:${id}`;
  const normalized = email.trim().toLowerCase();
  if (await users.findOne({ email: normalized, _id: { $ne: key as never } }, { session })) throw new ConflictException('Cet e-mail appartient déjà à un compte.');
  const current = await users.findOne({ _id: key as never }, { session });
  if (current && current.email !== normalized) throw new ConflictException('L’e-mail d’un compte invité ne peut pas être modifié.');
  await users.updateOne({ _id: key as never }, { $setOnInsert: { email: normalized, role: role || null, employeeId: id, active: true, createdAt: new Date() } }, { upsert: true, session });
 }
 async removeEmployee(id: string, session: ClientSession) {
  await this.db.collection('auth_users').deleteOne({ _id: `employee:${id}` as never }, { session });
  await this.db.collection('auth_sessions').deleteMany({ userId: `employee:${id}` }, { session });
 }
 async accounts() {
  const employees = await this.db.collection('employees').find({}, { projection: { id: 1, name: 1, email: 1, role: 1 } }).toArray();
  const users = await this.db.collection('auth_users').find({}, { projection: { email: 1, employeeId: 1, role: 1, active: 1, hash: 1 } }).toArray();
  return employees.map(e => { const u = users.find(u => u.employeeId === e.id); return { employeeId: e.id, name: e.name, email: e.email, businessRole: e.role, role: accessRoles.includes(u?.role) ? u!.role : '', active: u?.active ?? false, activated: !!u?.hash, hasAccount: !!u }; });
 }
 async changeAccount(id: string, body: unknown) {
  const value = body as { role?: AccessRole; active?: boolean };
  if (!value || Object.keys(value).some(k => !['role','active'].includes(k)) || (value.role !== undefined && !accessRoles.includes(value.role)) || (value.active !== undefined && typeof value.active !== 'boolean')) throw new BadRequestException('Rôle ou état invalide.');
  if (!await this.db.collection('auth_users').findOne({ _id: `employee:${id}` as never })) {
   const employee = await this.db.collection('employees').findOne({ id });
   if (!employee || !value.role) throw new BadRequestException('Employé et rôle d’accès requis.');
   await this.db.transaction(session => this.syncEmployee(id, employee.email, session, value.role));
  }
  const result = await this.db.collection('auth_users').updateOne({ _id: `employee:${id}` as never }, { $set: { ...(value.role ? { role: value.role } : {}), ...(value.active !== undefined ? { active: value.active } : {}) } });
  if (!result.matchedCount) throw new NotFoundException('Invitez d’abord cet employé.');
  await this.db.collection('auth_sessions').deleteMany({ userId: `employee:${id}` });
  return { ok: true };
 }
 async invite(id: string) {
  const user = await this.db.collection('auth_users').findOne({ _id: `employee:${id}` as never });
  if (!user) throw new BadRequestException('Attribuez un rôle d’accès avant d’inviter cet employé.');
  const account = await this.db.collection('auth_users').findOne({ _id: `employee:${id}` as never });
  if (!account?.active) throw new BadRequestException('Réactivez ce compte avant de l’inviter.');
  if (!accessRoles.includes(account.role)) throw new BadRequestException('Attribuez un rôle d’accès avant d’inviter cet employé.');
  if (account.hash) throw new ConflictException('Ce compte est déjà activé.');
  const token = randomBytes(32).toString('hex');
  await this.db.collection('auth_users').updateOne({ _id: `employee:${id}` as never }, { $set: { activationHash: digest(token), activationExpires: new Date(Date.now() + 48 * 3600000) } });
  const activationPath = `/?activation=${token}`;
  const base = process.env.APP_URL;
  let emailSent = false;
  if (process.env.SMTP_HOST && process.env.SMTP_FROM && base) {
   try {
    const transport = createTransport({ connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_PORT === '465', ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}) });
    await transport.sendMail({ from: process.env.SMTP_FROM, to: account.email, subject: 'Votre invitation coDrive', text: `Votre agence vous invite sur coDrive. Définissez votre mot de passe sous 48 heures : ${new URL(activationPath, base).href}` });
    emailSent = true;
   } catch { /* The administrator can copy the activation link and retry sending. */ }
  }
  return { activationPath, emailSent, expiresInHours: 48 };
 }
 async activate(body: unknown, req: Request) {
  this.limit(req); const value = body as { token?: unknown; password?: unknown }; const password = this.password(value?.password);
  if (typeof value.token !== 'string' || !/^[a-f0-9]{64}$/.test(value.token)) throw new BadRequestException('Lien invalide ou expiré.');
  const salt = randomBytes(16).toString('hex');
  const result = await this.db.collection('auth_users').updateOne({ activationHash: digest(value.token), active: true, hash: { $exists: false }, activationExpires: { $gt: new Date() } }, { $set: { salt, hash: scryptSync(password, salt, 64).toString('hex') }, $unset: { activationHash: '', activationExpires: '' } });
  if (!result.matchedCount) throw new BadRequestException('Lien invalide, expiré ou déjà utilisé.');
  return { ok: true };
 }
 async ownTasks(user: AuthUser) { return { tasks: await this.db.collection('tasks').find({ employeeId: user.employeeId || '__none__', status: 'Affectée' }, { projection: { _id: 0, __v: 0 } }).toArray(), shifts: await this.db.collection('shifts').find({ employeeId: user.employeeId || '__none__' }, { projection: { _id: 0, __v: 0 } }).toArray() }; }
 async progress(user: AuthUser, id: string, body: unknown) {
  const value = body as { progress?: string };
  if (!value || Object.keys(value).length !== 1 || !['À faire','En cours','Terminée'].includes(value.progress || '')) throw new BadRequestException('Statut invalide.');
  const result = await this.db.collection('tasks').updateOne({ id, employeeId: user.employeeId || '__none__', status: 'Affectée' }, { $set: { progress: value.progress, updatedAt: new Date() } });
  if (!result.matchedCount) throw new NotFoundException('Tâche introuvable.'); return { ok: true };
 }
}
