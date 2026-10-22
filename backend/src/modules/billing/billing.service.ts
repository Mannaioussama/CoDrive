import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
 DEFAULT_STAMP_MILLIMES, DEFAULT_VAT_BP, quote as quotePure, suggestPrices, invoiceTotals, invoiceStatus, vatSummary, sinistreNetCost,
 vehicleCategories, type VehicleCategory, type QuoteInput,
} from '../../../../lib/billing';

const id = () => randomUUID().replaceAll('-', '').slice(0, 24);

@Injectable()
export class BillingService implements OnModuleInit {
 constructor(@InjectConnection() private readonly db: Connection) {}

 async onModuleInit() {
  const settings = this.db.collection('billing_settings');
  if (!await settings.findOne({ _id: 'tax' as never })) {
   // VERIFY: Tunisian defaults VAT 19% / timbre 1 DT — editable in UI as « à vérifier ».
   await settings.insertOne({ _id: 'tax' as never, vatBp: DEFAULT_VAT_BP, stampMillimes: DEFAULT_STAMP_MILLIMES, label: 'à vérifier' });
  }
  await this.db.collection('billing_quotes').createIndex({ createdAt: -1 });
  await this.db.collection('billing_invoices').createIndex({ number: 1 }, { unique: true });
  await this.db.collection('billing_invoices').createIndex({ reservationId: 1 });
  await this.db.collection('billing_expenses').createIndex({ telegramMessageId: 1 }, { unique: true, sparse: true });
 }

 private col(name: string) { return this.db.collection(name); }

 async settings() {
  return this.col('billing_settings').findOne({ _id: 'tax' as never });
 }
 async saveSettings(body: unknown) {
  const value = body as { vatBp?: number; stampMillimes?: number };
  if (typeof value.vatBp !== 'number' || value.vatBp < 0 || typeof value.stampMillimes !== 'number' || value.stampMillimes < 0) {
   throw new BadRequestException('Paramètres fiscaux invalides.');
  }
  await this.col('billing_settings').updateOne({ _id: 'tax' as never }, { $set: { vatBp: Math.round(value.vatBp), stampMillimes: Math.round(value.stampMillimes) } });
  return this.settings();
 }

 async list(collection: string) {
  return this.col(collection).find({}, { projection: { _id: 0 } }).sort({ _id: -1 }).toArray();
 }

 async upsertRule(collection: string, body: Record<string, unknown>, allowed: string[]) {
  if (!body || Object.keys(body).some(k => !allowed.includes(k) && k !== 'id')) throw new BadRequestException('Champs invalides.');
  const doc = { ...body, id: typeof body.id === 'string' && body.id ? body.id : id(), updatedAt: new Date() };
  await this.col(collection).updateOne({ id: doc.id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return doc;
 }

 async removeRule(collection: string, itemId: string) {
  const r = await this.col(collection).deleteOne({ id: itemId });
  if (!r.deletedCount) throw new NotFoundException();
  return { ok: true };
 }

 async categories() {
  const rates = await this.list('billing_base_rates') as unknown as { category: string; dailyMillimes: number; valideDepuis: string; active?: boolean }[];
  return vehicleCategories.map(category => {
   const active = rates.filter(r => r.category === category && r.active !== false).sort((a, b) => b.valideDepuis.localeCompare(a.valideDepuis))[0];
   return { category, dailyMillimes: active?.dailyMillimes ?? null, valideDepuis: active?.valideDepuis ?? null };
  });
 }

 async createQuote(body: unknown) {
  const input = body as QuoteInput;
  const [rates, seasons, discounts, partners] = await Promise.all([
   this.list('billing_base_rates'), this.list('billing_seasons'), this.list('billing_duration_discounts'), this.list('billing_partner_rates'),
  ]);
  let result;
  try { result = quotePure(input, rates as never, seasons as never, discounts as never, partners as never); }
  catch (e) { throw new BadRequestException(e instanceof Error ? e.message : 'Devis impossible.'); }
  const quoteId = id();
  const doc = { id: quoteId, quoteId, ...input, ...result, createdAt: new Date(), frozen: true };
  await this.col('billing_quotes').insertOne(doc);
  return doc;
 }

 async suggestions() {
  const [rates, seasons, signals] = await Promise.all([
   this.list('billing_base_rates'), this.list('billing_seasons'), this.list('billing_demand_signals'),
  ]);
  const proposed = suggestPrices({ rates: rates as never, seasons: seasons as never, signals: signals as never });
  const existing = await this.col('billing_price_suggestions').find({ status: 'proposée' }).toArray();
  for (const s of proposed) {
   const found = existing.find(e => e.category === s.category && e.status === 'proposée');
   if (found) continue;
   const doc = { ...s, id: id(), status: 'proposée', createdAt: new Date() };
   await this.col('billing_price_suggestions').insertOne(doc);
  }
  return this.col('billing_price_suggestions').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
 }

 async decideSuggestion(itemId: string, body: unknown, userId: string) {
  const value = body as { decision?: string };
  if (!['acceptée', 'refusée'].includes(value.decision || '')) throw new BadRequestException('Décision invalide.');
  const suggestion = await this.col('billing_price_suggestions').findOne({ id: itemId });
  if (!suggestion || suggestion.status !== 'proposée') throw new NotFoundException('Suggestion introuvable.');
  if (value.decision === 'refusée') {
   await this.col('billing_price_suggestions').updateOne({ id: itemId }, { $set: { status: 'refusée', decidedAt: new Date(), decidedBy: userId } });
   return { ok: true };
  }
  const today = new Date().toISOString().slice(0, 10);
  const seasonId = id();
  const season = {
   id: seasonId, name: `Suggestion ${suggestion.category} ${today}`,
   dateDebut: today, dateFin: today.slice(0, 4) + '-12-31',
   coefficientBp: suggestion.suggestedCoefficientBp, categories: [suggestion.category], active: true,
  };
  await this.db.transaction(async session => {
   await this.col('billing_seasons').insertOne({ ...season, createdAt: new Date() }, { session });
   await this.col('billing_price_suggestions').updateOne({ id: itemId }, { $set: { status: 'acceptée', decidedAt: new Date(), decidedBy: userId, appliedSeasonId: seasonId, beforeCoefficientBp: suggestion.currentCoefficientBp, afterCoefficientBp: suggestion.suggestedCoefficientBp } }, { session });
  });
  return { ok: true, season };
 }

 private async nextNumber(prefix: 'FAC' | 'AVO', year: number, session: import('mongoose').ClientSession) {
  const key = `${prefix}-${year}`;
  const counter = await this.col('billing_counters').findOneAndUpdate(
   { _id: key as never },
   { $inc: { seq: 1 } },
   { upsert: true, returnDocument: 'after', session },
  );
  const seq = counter?.seq ?? 1;
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
 }

 async listInvoices(reservationId?: string): Promise<Record<string, unknown>[]> {
  const filter = reservationId ? { reservationId } : {};
  const rows = await this.col('billing_invoices').find(filter, { projection: { _id: 0 } }).sort({ dateEmission: -1 }).toArray() as unknown as Record<string, unknown>[];
  const today = new Date().toISOString().slice(0, 10);
  return rows.map(inv => ({
   ...inv,
   status: invoiceStatus({
    status: String(inv.status),
    dateEcheance: String(inv.dateEcheance || ''),
    totalTTC: Number(inv.totalTTC || 0),
    paidMillimes: Number(inv.paidMillimes || 0),
   }, today),
   remaining: Math.max(0, Number(inv.totalTTC || 0) - Number(inv.paidMillimes || 0)),
  }));
 }

 async saveInvoice(body: unknown, userId: string) {
  const value = body as Record<string, unknown>;
  const tax = await this.settings();
  const lines = Array.isArray(value.lines) ? value.lines as { label: string; quantity: number; unitPriceMillimes: number }[] : [];
  if (!lines.length) throw new BadRequestException('Au moins une ligne est requise.');
  const totals = invoiceTotals(lines.map(l => ({ quantity: Number(l.quantity), unitPriceMillimes: Number(l.unitPriceMillimes) })), tax!.vatBp, tax!.stampMillimes);
  const snapshot = {
   raisonSociale: String(value.raisonSociale || '').trim(),
   matriculeFiscal: String(value.matriculeFiscal || '').trim(),
   adresse: String(value.adresse || '').trim(),
  };
  if (!snapshot.raisonSociale) throw new BadRequestException('Raison sociale requise.');
  const invoiceId = typeof value.id === 'string' && value.id ? value.id : id();
  const existing = await this.col('billing_invoices').findOne({ id: invoiceId });
  if (existing && existing.status !== 'brouillon') throw new BadRequestException('Seuls les brouillons sont modifiables.');
  const doc = {
   id: invoiceId, number: existing?.number || null, status: 'brouillon',
   clientId: value.clientId ? String(value.clientId) : '',
   reservationId: value.reservationId ? String(value.reservationId) : '',
   quoteId: value.quoteId ? String(value.quoteId) : '',
   ...snapshot, lines: lines.map(l => ({ ...l, lineTotal: Math.round(Number(l.quantity) * Number(l.unitPriceMillimes)) })),
   ...totals, vatBp: tax!.vatBp, dateEmission: String(value.dateEmission || new Date().toISOString().slice(0, 10)),
   dateEcheance: String(value.dateEcheance || ''), paidMillimes: existing?.paidMillimes || 0, payments: existing?.payments || [],
   updatedAt: new Date(), updatedBy: userId,
  };
  await this.col('billing_invoices').updateOne({ id: invoiceId }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return doc;
 }

 async issueInvoice(invoiceId: string) {
  const inv = await this.col('billing_invoices').findOne({ id: invoiceId });
  if (!inv || inv.status !== 'brouillon') throw new BadRequestException('Facture non émettable.');
  const year = Number(String(inv.dateEmission).slice(0, 4)) || new Date().getFullYear();
  await this.db.transaction(async session => {
   const number = await this.nextNumber('FAC', year, session);
   await this.col('billing_invoices').updateOne({ id: invoiceId }, { $set: { status: 'émise', number, issuedAt: new Date() } }, { session });
  });
  return (await this.listInvoices()).find(i => i.id === invoiceId);
 }

 async addPayment(invoiceId: string, body: unknown) {
  const value = body as { date?: string; montant?: number; mode?: string; reference?: string };
  const modes = ['virement', 'chèque', 'espèces', 'carte'];
  if (typeof value.montant !== 'number' || value.montant <= 0 || !modes.includes(value.mode || '')) throw new BadRequestException('Paiement invalide.');
  const inv = await this.col('billing_invoices').findOne({ id: invoiceId });
  if (!inv || !['émise', 'en retard', 'payée'].includes(inv.status)) throw new BadRequestException('Paiement refusé.');
  const paid = (inv.paidMillimes || 0) + Math.round(value.montant);
  if (paid > inv.totalTTC) throw new BadRequestException('Montant supérieur au reste à payer.');
  const payment = { id: id(), date: value.date || new Date().toISOString().slice(0, 10), montant: Math.round(value.montant), mode: value.mode, reference: String(value.reference || '') };
  const status = paid >= inv.totalTTC ? 'payée' : inv.status;
  await this.col('billing_invoices').updateOne({ id: invoiceId }, { $set: { paidMillimes: paid, status }, $push: { payments: payment as never } });
  return this.listInvoices().then(rows => rows.find(i => i.id === invoiceId));
 }

 async creditNote(invoiceId: string, body: unknown) {
  const value = body as { amountMillimes?: number; motif?: string };
  const inv = await this.col('billing_invoices').findOne({ id: invoiceId });
  if (!inv || !['émise', 'en retard', 'payée'].includes(inv.status)) throw new BadRequestException('Avoir impossible.');
  const remaining = inv.totalTTC - (inv.paidMillimes || 0);
  const amount = Math.round(Number(value.amountMillimes));
  if (!amount || amount <= 0 || amount > remaining + (inv.paidMillimes || 0)) throw new BadRequestException('Montant d’avoir invalide.');
  const year = new Date().getFullYear();
  let number = '';
  await this.db.transaction(async session => {
   number = await this.nextNumber('AVO', year, session);
   await this.col('billing_credit_notes').insertOne({
    id: id(), number, invoiceId, amountMillimes: amount, motif: String(value.motif || ''), createdAt: new Date(),
   }, { session });
  });
  return { number, invoiceId, amountMillimes: amount };
 }

 async invoiceFromQuote(quoteId: string, body: unknown, userId: string) {
  const q = await this.col('billing_quotes').findOne({ id: quoteId });
  if (!q) throw new NotFoundException('Devis introuvable.');
  const value = body as Record<string, unknown>;
  return this.saveInvoice({
   ...value, quoteId, lines: [{ label: `Location ${q.categorie} (${q.jours} j)`, quantity: 1, unitPriceMillimes: q.total }],
  }, userId);
 }

 async saveExpense(body: unknown) {
  const value = body as Record<string, unknown>;
  const cats = ['pièces', 'réparation', 'carburant', 'assurance', 'achat stock', 'autre'];
  if (!cats.includes(String(value.categorie))) throw new BadRequestException('Catégorie de dépense invalide.');
  const doc = {
   id: typeof value.id === 'string' && value.id ? value.id : id(),
   fournisseur: String(value.fournisseur || '').trim(),
   date: String(value.date || ''),
   categorie: value.categorie,
   numeroFacture: String(value.numeroFacture || ''),
   montantHT: Math.round(Number(value.montantHT) || 0),
   tva: Math.round(Number(value.tva) || 0),
   montantTTC: Math.round(Number(value.montantTTC) || 0),
   vehicleId: String(value.vehicleId || ''),
   maintenanceId: String(value.maintenanceId || ''),
   sinistreId: String(value.sinistreId || ''),
   notes: String(value.notes || ''),
   status: String(value.status || 'justificatif manquant'),
   attachmentUrl: value.attachmentUrl ? String(value.attachmentUrl) : '',
   updatedAt: new Date(),
  };
  if (!doc.fournisseur || !doc.date) throw new BadRequestException('Fournisseur et date requis.');
  const existing = await this.col('billing_expenses').findOne({ id: doc.id });
  if (existing?.status === 'validée') throw new BadRequestException('Dépense validée verrouillée.');
  await this.col('billing_expenses').updateOne({ id: doc.id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return doc;
 }

 async setExpenseStatus(itemId: string, status: string) {
  const allowed = ['justificatif manquant', 'à valider', 'validée', 'rejetée'];
  if (!allowed.includes(status)) throw new BadRequestException('Statut invalide.');
  const exp = await this.col('billing_expenses').findOne({ id: itemId });
  if (!exp) throw new NotFoundException();
  if (exp.status === 'validée' && status !== 'validée') throw new BadRequestException('Dépense validée verrouillée.');
  await this.col('billing_expenses').updateOne({ id: itemId }, { $set: { status } });
  return { ok: true };
 }

 async saveSinistre(body: unknown) {
  const value = body as Record<string, unknown>;
  const statuses = ['ouvert', 'déclaré à l\'assureur', 'en expertise', 'indemnisé', 'clôturé'];
  const status = String(value.status || 'ouvert');
  if (!statuses.includes(status)) throw new BadRequestException('Statut sinistre invalide.');
  const doc = {
   id: typeof value.id === 'string' && value.id ? value.id : id(),
   sinistreId: String(value.sinistreId || ''),
   vehicleId: String(value.vehicleId || ''),
   reservationId: String(value.reservationId || ''),
   date: String(value.date || ''),
   description: String(value.description || ''),
   insurer: String(value.insurer || ''),
   policyNumber: String(value.policyNumber || ''),
   insurerFileNumber: String(value.insurerFileNumber || ''),
   status,
   damageMillimes: Math.round(Number(value.damageMillimes) || 0),
   franchiseMillimes: Math.round(Number(value.franchiseMillimes) || 0),
   expectedCompensationMillimes: Math.round(Number(value.expectedCompensationMillimes) || 0),
   receivedCompensationMillimes: Math.round(Number(value.receivedCompensationMillimes) || 0),
   reinvoiceAmountMillimes: Math.round(Number(value.reinvoiceAmountMillimes) || 0),
   reinvoiceStatus: String(value.reinvoiceStatus || ''),
   updatedAt: new Date(),
  };
  if (status === 'clôturé') {
   const linked = await this.col('billing_expenses').find({ sinistreId: doc.id }).toArray();
   if (linked.some(e => e.status === 'justificatif manquant')) throw new BadRequestException('Impossible de clôturer : justificatif manquant sur une dépense liée.');
  }
  await this.col('billing_sinistres').updateOne({ id: doc.id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  const expenses = await this.col('billing_expenses').find({ sinistreId: doc.id }).toArray();
  const expensesTtc = expenses.reduce((s, e) => s + (e.montantTTC || 0), 0);
  const reinvoicedPaid = doc.reinvoiceStatus === 'payée' ? doc.reinvoiceAmountMillimes : 0;
  return { ...doc, linkedExpenses: expenses, netCost: sinistreNetCost(expensesTtc, doc.receivedCompensationMillimes, reinvoicedPaid) };
 }

 async listSinistres() {
  const rows = await this.list('billing_sinistres');
  const out = [];
  for (const doc of rows) {
   const expenses = await this.col('billing_expenses').find({ sinistreId: doc.id }).toArray();
   const expensesTtc = expenses.reduce((s, e) => s + (e.montantTTC || 0), 0);
   const reinvoicedPaid = doc.reinvoiceStatus === 'payée' ? doc.reinvoiceAmountMillimes : 0;
   out.push({ ...doc, linkedExpenses: expenses, netCost: sinistreNetCost(expensesTtc, doc.receivedCompensationMillimes || 0, reinvoicedPaid) });
  }
  return out;
 }

 async saveObligation(body: unknown) {
  const value = body as Record<string, unknown>;
  const statuses = ['à faire', 'déposée', 'payée'];
  const doc = {
   id: typeof value.id === 'string' && value.id ? value.id : id(),
   type: String(value.type || ''),
   label: String(value.label || ''),
   period: String(value.period || ''),
   dateEcheance: String(value.dateEcheance || ''),
   estimatedMillimes: Math.round(Number(value.estimatedMillimes) || 0),
   status: statuses.includes(String(value.status)) ? value.status : 'à faire',
   reference: String(value.reference || ''),
   updatedAt: new Date(),
  };
  if (!doc.label || !doc.dateEcheance) throw new BadRequestException('Libellé et échéance requis.');
  await this.col('billing_obligations').updateOne({ id: doc.id }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return doc;
 }

 async fiscalVat(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Mois attendu AAAA-MM.');
  const invoices = await this.col('billing_invoices').find({ dateEmission: { $regex: `^${month}` } }).toArray();
  const expenses = await this.col('billing_expenses').find({ date: { $regex: `^${month}` } }).toArray();
  const summary = vatSummary(invoices as never, expenses as never);
  return { month, ...summary, invoices, expenses };
 }

 async kpis() {
  const today = new Date().toISOString().slice(0, 10);
  const invoices = await this.listInvoices();
  const unpaid = invoices.filter(i => ['émise', 'en retard'].includes(String(i.status)));
  const overdue = invoices.filter(i => i.status === 'en retard' || (i.status === 'émise' && String(i.dateEcheance) < today && Number(i.remaining) > 0));
  const expenses = await this.list('billing_expenses') as unknown as { status: string }[];
  const toValidate = expenses.filter(e => e.status === 'à valider' || e.status === 'justificatif manquant');
  const month = today.slice(0, 7);
  const vat = await this.fiscalVat(month);
  return {
   unpaidTotal: unpaid.reduce((s, i) => s + Number(i.remaining || 0), 0),
   overdueCount: overdue.length,
   expensesToValidate: toValidate.length,
   vatPayableThisMonth: vat.payable,
  };
 }

 async integrationReceipt(body: unknown) {
  const value = body as { telegramMessageId?: string; fileUrl?: string; ocr?: Record<string, unknown>; confidence?: number };
  if (!value.telegramMessageId) throw new BadRequestException('telegramMessageId requis.');
  const existing = await this.col('billing_expenses').findOne({ telegramMessageId: value.telegramMessageId });
  if (existing) return existing;
  const ocr = value.ocr || {};
  const doc = {
   id: id(),
   telegramMessageId: value.telegramMessageId,
   attachmentUrl: String(value.fileUrl || ''),
   fournisseur: String(ocr.fournisseur || 'OCR'),
   date: String(ocr.date || new Date().toISOString().slice(0, 10)),
   categorie: 'autre',
   numeroFacture: String(ocr.numero || ''),
   montantHT: 0,
   tva: Math.round(Number(ocr.tva) || 0),
   montantTTC: Math.round(Number(ocr.montantTTC) || 0),
   status: 'à valider',
   notes: `Import n8n · confiance ${value.confidence ?? ''}`,
   createdAt: new Date(),
  };
  await this.col('billing_expenses').insertOne(doc);
  return doc;
 }
}
