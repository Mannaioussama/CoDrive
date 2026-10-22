/** Comptabilité — pure business logic. Money = millimes (1 DT = 1000). Rates = basis points (19% = 1900, coef 1.15 = 11500). */

export const vehicleCategories = ['ECONOMIQUE', 'COMPACTE', 'BERLINE', 'SUV', 'PREMIUM', 'UTILITAIRE'] as const;
export type VehicleCategory = (typeof vehicleCategories)[number];
export const categoryLabels: Record<VehicleCategory, string> = {
 ECONOMIQUE: 'Économique', COMPACTE: 'Compacte', BERLINE: 'Berline', SUV: 'SUV', PREMIUM: 'Premium', UTILITAIRE: 'Utilitaire',
};

export const MILLIMES_PER_DT = 1000;
export const BP_UNIT = 10000; // 100% = 10000 bp for coefficients; percentages use 10000 = 100% too (1% = 100 bp)

export function millimesToDt(m: number): string {
 return new Intl.NumberFormat('fr-TN', { style: 'currency', currency: 'TND', minimumFractionDigits: 3 }).format(m / MILLIMES_PER_DT);
}
export function applyBp(amountMillimes: number, bp: number): number {
 return Math.round((amountMillimes * bp) / BP_UNIT);
}
export function daysBetween(dateDebut: string, dateFin: string): number {
 const a = Date.parse(`${dateDebut}T00:00:00Z`);
 const b = Date.parse(`${dateFin}T00:00:00Z`);
 if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) throw new Error('Dates invalides : dateFin doit être ≥ dateDebut.');
 return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
export function eachDate(dateDebut: string, dateFin: string): string[] {
 const out: string[] = [];
 let cur = dateDebut;
 const end = dateFin;
 while (cur <= end) {
  out.push(cur);
  const d = new Date(`${cur}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  cur = d.toISOString().slice(0, 10);
 }
 return out;
}

export type SeasonRule = { id: string; name: string; dateDebut: string; dateFin: string; coefficientBp: number; categories?: VehicleCategory[]; active?: boolean };
export type DurationDiscount = { id: string; minDays: number; discountBp: number; active?: boolean };
export type PartnerRate = { id: string; clientId: string; raisonSociale: string; category: VehicleCategory | 'ALL'; discountBp?: number; fixedDailyMillimes?: number; active?: boolean };
export type BaseRate = { id: string; category: VehicleCategory; dailyMillimes: number; valideDepuis: string; active?: boolean };
export type PenaltyRule = { id: string; type: 'annulation tardive' | 'retard de restitution' | 'kilomètres excédentaires'; amountMillimes?: number; percentBp?: number; parameters?: string; active?: boolean };

export type QuoteInput = { categorie: VehicleCategory; clientId?: string; dateDebut: string; dateFin: string };
export type QuoteLine = { date: string; dailyMillimes: number; seasonName?: string; coefficientBp: number };
export type QuoteResult = {
 jours: number;
 categorie: VehicleCategory;
 tarifJournalierBase: number;
 lines: QuoteLine[];
 sousTotal: number;
 durationDiscountBp: number;
 durationDiscountAmount: number;
 partnerDiscountBp: number;
 partnerFixedDaily?: number;
 partnerDiscountAmount: number;
 total: number;
};

export function activeBaseRate(rates: BaseRate[], category: VehicleCategory, onDate: string): BaseRate | null {
 const list = rates.filter(r => r.category === category && r.valideDepuis <= onDate && r.active !== false)
  .sort((a, b) => b.valideDepuis.localeCompare(a.valideDepuis));
 return list[0] || null;
}

export function seasonForDay(seasons: SeasonRule[], category: VehicleCategory, day: string): SeasonRule | null {
 return seasons.find(s => s.active !== false && s.dateDebut <= day && day <= s.dateFin && (!s.categories?.length || s.categories.includes(category))) || null;
}

export function bestDurationDiscount(discounts: DurationDiscount[], days: number): DurationDiscount | null {
 const list = discounts.filter(d => d.active !== false && d.minDays <= days).sort((a, b) => b.minDays - a.minDays || b.discountBp - a.discountBp);
 return list[0] || null;
}

export function partnerFor(partners: PartnerRate[], clientId: string | undefined, category: VehicleCategory): PartnerRate | null {
 if (!clientId) return null;
 return partners.find(p => p.active !== false && p.clientId === clientId && (p.category === 'ALL' || p.category === category)) || null;
}

/** Pure quote engine — rounds once at the end in millimes. */
export function quote(
 input: QuoteInput,
 rates: BaseRate[],
 seasons: SeasonRule[],
 discounts: DurationDiscount[],
 partners: PartnerRate[],
): QuoteResult {
 if (!vehicleCategories.includes(input.categorie)) throw new Error('Catégorie inconnue.');
 if (input.dateFin < input.dateDebut) throw new Error('dateFin avant dateDebut.');
 const jours = daysBetween(input.dateDebut, input.dateFin);
 const dates = eachDate(input.dateDebut, input.dateFin);
 const lines: QuoteLine[] = [];
 let sousTotal = 0;
 let tarifJournalierBase = 0;
 for (const day of dates) {
  const base = activeBaseRate(rates, input.categorie, day);
  if (!base) throw new Error(`Tarif inactif ou manquant pour ${input.categorie} au ${day}.`);
  tarifJournalierBase = base.dailyMillimes;
  const season = seasonForDay(seasons, input.categorie, day);
  const coefficientBp = season?.coefficientBp ?? BP_UNIT;
  const daily = applyBp(base.dailyMillimes, coefficientBp);
  lines.push({ date: day, dailyMillimes: daily, seasonName: season?.name, coefficientBp });
  sousTotal += daily;
 }
 const dur = bestDurationDiscount(discounts, jours);
 const durationDiscountBp = dur?.discountBp ?? 0;
 const durationDiscountAmount = applyBp(sousTotal, durationDiscountBp);
 let afterDuration = sousTotal - durationDiscountAmount;
 const partner = partnerFor(partners, input.clientId, input.categorie);
 let partnerDiscountBp = 0;
 let partnerDiscountAmount = 0;
 let partnerFixedDaily: number | undefined;
 if (partner?.fixedDailyMillimes != null) {
  partnerFixedDaily = partner.fixedDailyMillimes;
  const fixedTotal = partner.fixedDailyMillimes * jours;
  partnerDiscountAmount = afterDuration - fixedTotal;
  afterDuration = fixedTotal;
 } else if (partner?.discountBp) {
  partnerDiscountBp = partner.discountBp;
  partnerDiscountAmount = applyBp(afterDuration, partnerDiscountBp);
  afterDuration -= partnerDiscountAmount;
 }
 return {
  jours, categorie: input.categorie, tarifJournalierBase, lines, sousTotal,
  durationDiscountBp, durationDiscountAmount, partnerDiscountBp, partnerFixedDaily, partnerDiscountAmount,
  total: Math.round(afterDuration),
 };
}

export type DemandSignal = { categorie: VehicleCategory; date: string; reservations: number; vehiculesDisponibles: number };
export type PriceSuggestion = {
 id?: string;
 category: VehicleCategory;
 suggestedCoefficientBp: number;
 currentCoefficientBp: number;
 reason: string;
 confidence: 'faible' | 'moyenne' | 'élevée';
 status?: 'proposée' | 'acceptée' | 'refusée';
};

/** Explainable rule-based suggestions — no external AI. */
export function suggestPrices(context: {
 seasons: SeasonRule[];
 rates: BaseRate[];
 signals: DemandSignal[];
 asOf?: string;
}): PriceSuggestion[] {
 const asOf = context.asOf || new Date().toISOString().slice(0, 10);
 const out: PriceSuggestion[] = [];
 for (const category of vehicleCategories) {
  const base = activeBaseRate(context.rates, category, asOf);
  if (!base) continue;
  const season = seasonForDay(context.seasons, category, asOf);
  const currentCoefficientBp = season?.coefficientBp ?? BP_UNIT;
  const catSignals = context.signals.filter(s => s.categorie === category).sort((a, b) => a.date.localeCompare(b.date));
  // Approximate weeks of history from distinct ISO week keys (YYYY-Www).
  const weeks = new Set(catSignals.map(s => {
   const d = new Date(`${s.date}T12:00:00Z`);
   const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
   const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
   return `${d.getUTCFullYear()}-W${week}`;
  })).size;
  let suggested = currentCoefficientBp;
  let reason: string;
  let confidence: PriceSuggestion['confidence'];

  if (weeks < 4) {
   // Fallback: seasons / holidays only
   if (season && season.coefficientBp > BP_UNIT) {
    suggested = season.coefficientBp;
    reason = `Faible historique (< 4 semaines) : maintien du coefficient de saison « ${season.name} ».`;
    confidence = 'faible';
   } else if (season && season.coefficientBp < BP_UNIT) {
    suggested = season.coefficientBp;
    reason = `Faible historique (< 4 semaines) : application du coefficient saisonnier bas « ${season.name} ».`;
    confidence = 'faible';
   } else {
    suggested = BP_UNIT;
    reason = 'Données de demande insuffisantes (< 4 semaines) : coefficient neutre (1,00) proposé.';
    confidence = 'faible';
   }
  } else {
   const recent = catSignals.slice(-28);
   const util = recent.map(s => s.vehiculesDisponibles > 0 ? s.reservations / s.vehiculesDisponibles : 0);
   const avg = util.reduce((a, b) => a + b, 0) / util.length;
   const prev = util.slice(0, Math.max(1, util.length - 7));
   const recentAvg = util.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, util.length);
   const pace = recentAvg - (prev.reduce((a, b) => a + b, 0) / prev.length);
   if (avg >= 0.85 || pace > 0.1) {
    suggested = Math.min(15000, currentCoefficientBp + 500);
    reason = `Forte utilisation (${Math.round(avg * 100)} %) ou rythme de réservation en hausse : +5 % de coefficient suggéré.`;
    confidence = 'élevée';
   } else if (avg <= 0.4) {
    suggested = Math.max(8000, currentCoefficientBp - 500);
    reason = `Faible utilisation (${Math.round(avg * 100)} %) : −5 % de coefficient pour stimuler la demande.`;
    confidence = 'moyenne';
   } else {
    suggested = currentCoefficientBp;
    reason = `Utilisation stable (${Math.round(avg * 100)} %) : aucun changement de coefficient.`;
    confidence = 'moyenne';
   }
   if (season && Math.abs(season.coefficientBp - BP_UNIT) >= 500) {
    reason += ` Saison « ${season.name} » prise en compte (coef actuel).`;
   }
  }
  if (suggested === currentCoefficientBp && confidence !== 'faible') continue;
  out.push({ category, suggestedCoefficientBp: suggested, currentCoefficientBp, reason, confidence, status: 'proposée' });
 }
 return out;
}

export function invoiceTotals(lines: { quantity: number; unitPriceMillimes: number }[], vatBp: number, stampMillimes: number) {
 const totalHT = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPriceMillimes, 0));
 const vat = applyBp(totalHT, vatBp);
 const totalTTC = totalHT + vat + stampMillimes;
 return { totalHT, vat, stampMillimes, totalTTC };
}

export function invoiceStatus(inv: { status: string; dateEcheance: string; totalTTC: number; paidMillimes: number }, today: string): string {
 if (['annulée', 'brouillon', 'payée'].includes(inv.status)) return inv.status;
 if (inv.paidMillimes >= inv.totalTTC) return 'payée';
 if (inv.status === 'émise' && inv.dateEcheance < today && inv.paidMillimes < inv.totalTTC) return 'en retard';
 return inv.status;
}

export function sinistreNetCost(expensesTtc: number, compensationReceived: number, reinvoicedPaid: number): number {
 return expensesTtc - compensationReceived - reinvoicedPaid;
}

export function vatSummary(invoices: { status: string; vat: number }[], expenses: { status: string; tva: number }[]) {
 const collected = invoices.filter(i => i.status === 'émise' || i.status === 'payée' || i.status === 'en retard').reduce((s, i) => s + i.vat, 0);
 const deductible = expenses.filter(e => e.status === 'validée').reduce((s, e) => s + e.tva, 0);
 return { collected, deductible, payable: collected - deductible };
}

/** VERIFY: Tunisian defaults — VAT 19%, timbre fiscal 1 DT. Editable in billing_settings. */
export const DEFAULT_VAT_BP = 1900;
export const DEFAULT_STAMP_MILLIMES = 1000;
