import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
 quote, suggestPrices, daysBetween, applyBp, invoiceTotals, vatSummary, sinistreNetCost, BP_UNIT,
} from '../lib/billing.ts';

const rates = [
 { id: 'r1', category: 'ECONOMIQUE', dailyMillimes: 100_000, valideDepuis: '2026-01-01', active: true },
 { id: 'r2', category: 'ECONOMIQUE', dailyMillimes: 120_000, valideDepuis: '2026-06-01', active: true },
];
const seasons = [
 { id: 's1', name: 'Été', dateDebut: '2026-07-01', dateFin: '2026-08-31', coefficientBp: 12000, active: true },
];
const discounts = [{ id: 'd1', minDays: 7, discountBp: 1000, active: true }];
const partners = [{ id: 'p1', clientId: 'c1', raisonSociale: 'Fleet SA', category: 'ALL', discountBp: 500, active: true }];

test('daysBetween inclusive and rejects inverted range', () => {
 assert.equal(daysBetween('2026-07-01', '2026-07-01'), 1);
 assert.equal(daysBetween('2026-07-01', '2026-07-03'), 3);
 assert.throws(() => daysBetween('2026-07-05', '2026-07-01'));
});

test('quote : base, saison croisée, remise durée et partenaire', () => {
 const q = quote(
  { categorie: 'ECONOMIQUE', clientId: 'c1', dateDebut: '2026-06-29', dateFin: '2026-07-05' },
  rates, seasons, discounts, partners,
 );
 assert.equal(q.jours, 7);
 assert.ok(q.lines.some(l => l.seasonName === 'Été'));
 assert.ok(q.lines.some(l => l.coefficientBp === BP_UNIT));
 assert.equal(q.durationDiscountBp, 1000);
 assert.equal(q.partnerDiscountBp, 500);
 assert.equal(q.total, Math.round(q.sousTotal - q.durationDiscountAmount - q.partnerDiscountAmount));
});

test('quote refuse catégorie inconnue et tarif manquant', () => {
 assert.throws(() => quote({ categorie: 'LUXE', dateDebut: '2026-01-01', dateFin: '2026-01-02' }, rates, [], [], []));
 assert.throws(() => quote({ categorie: 'SUV', dateDebut: '2026-01-01', dateFin: '2026-01-02' }, rates, [], [], []));
});

test('suggestPrices fallback saison si < 4 semaines de signaux', () => {
 const suggestions = suggestPrices({
  seasons, rates,
  signals: [{ categorie: 'ECONOMIQUE', date: '2026-07-10', reservations: 2, vehiculesDisponibles: 5 }],
  asOf: '2026-07-15',
 });
 const eco = suggestions.find(s => s.category === 'ECONOMIQUE');
 assert.ok(eco);
 assert.equal(eco.confidence, 'faible');
 assert.match(eco.reason, /Faible historique|saison/i);
});

test('suggestPrices hausse si forte utilisation', () => {
 const signals = [];
 for (let i = 0; i < 35; i++) {
  const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  signals.push({ categorie: 'ECONOMIQUE', date: d, reservations: 9, vehiculesDisponibles: 10 });
 }
 const suggestions = suggestPrices({ seasons: [], rates, signals, asOf: '2026-02-05' });
 const eco = suggestions.find(s => s.category === 'ECONOMIQUE');
 assert.ok(eco);
 assert.ok(eco.suggestedCoefficientBp > BP_UNIT);
 assert.equal(eco.confidence, 'élevée');
});

test('invoiceTotals et TVA', () => {
 const t = invoiceTotals([{ quantity: 2, unitPriceMillimes: 50_000 }], 1900, 1000);
 assert.equal(t.totalHT, 100_000);
 assert.equal(t.vat, applyBp(100_000, 1900));
 assert.equal(t.totalTTC, t.totalHT + t.vat + 1000);
});

test('vatSummary et coût net sinistre', () => {
 const v = vatSummary(
  [{ status: 'émise', vat: 19000 }, { status: 'brouillon', vat: 999 }],
  [{ status: 'validée', tva: 5000 }, { status: 'à valider', tva: 1000 }],
 );
 assert.equal(v.collected, 19000);
 assert.equal(v.deductible, 5000);
 assert.equal(v.payable, 14000);
 assert.equal(sinistreNetCost(100_000, 40_000, 10_000), 50_000);
});
