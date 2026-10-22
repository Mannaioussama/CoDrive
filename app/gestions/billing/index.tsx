"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional fetch-on-mount for billing panels */
import { useCallback, useEffect, useState } from 'react';
import { canManage } from '../../../lib/access';
import { useAuth } from '../../components/auth-gate';
import { Icon, Badge, Empty, Dialog } from '../../components/ui';
import { categoryLabels, millimesToDt, vehicleCategories, BP_UNIT, type VehicleCategory } from '../../../lib/billing';
import { billingGet, billingSend } from './billing-api';
import './billing.css';

const TABS = ['Tarifs', 'Facturation clients', 'Dépenses & justificatifs', 'Sinistres & assurances', 'Fiscalité', 'Trésorerie & analyse'] as const;

type Props = { embeddedTab?: number; onTabLabels?: (tabs: readonly string[]) => void };

export function BillingGestion({ embeddedTab, onTabLabels }: Props = {}) {
 const user = useAuth();
 const canWrite = canManage(user.role, 'billing');
 const [tab, setTab] = useState(0);
 const activeTab = embeddedTab ?? tab;
 const [kpis, setKpis] = useState<{ unpaidTotal: number; overdueCount: number; expensesToValidate: number; vatPayableThisMonth: number } | null>(null);
 const [toast, setToast] = useState('');
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');

 useEffect(() => { onTabLabels?.(TABS); }, [onTabLabels]);
 useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); } }, [toast]);

 const refreshKpis = useCallback(async () => {
  try { setKpis(await billingGet('/kpis')); } catch { /* ignore */ }
 }, []);

 useEffect(() => { void refreshKpis(); }, [refreshKpis, activeTab]);

 const run = async (fn: () => Promise<unknown>, ok = 'Enregistré.') => {
  if (!canWrite) return;
  setBusy(true); setError('');
  try { await fn(); setToast(ok); await refreshKpis(); }
  catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
  finally { setBusy(false); }
 };

 return (
  <div className="billing-root">
   <div className="billing-kpis" aria-label="Indicateurs comptables">
    <Kpi label="Impayés" value={kpis ? millimesToDt(kpis.unpaidTotal) : '…'} icon="file" tone="blue" />
    <Kpi label="Échéances en retard" value={kpis ? String(kpis.overdueCount) : '…'} icon="alert" tone="orange" />
    <Kpi label="Dépenses à valider" value={kpis ? String(kpis.expensesToValidate) : '…'} icon="box" tone="violet" />
    <Kpi label="TVA du mois" value={kpis ? millimesToDt(kpis.vatPayableThisMonth) : '…'} icon="spark" tone="teal" />
   </div>
   {embeddedTab === undefined && (
    <div className="tabs" role="tablist" aria-label="Comptabilité">
     {TABS.map((label, i) => (
      <button key={label} role="tab" aria-selected={activeTab === i} className={activeTab === i ? 'active' : ''} onClick={() => setTab(i)}>{label}</button>
     ))}
    </div>
   )}
   {!canWrite && <p className="billing-readonly"><Badge tone="blue">Consultation uniquement</Badge> Vous pouvez consulter la comptabilité sans la modifier.</p>}
   {error && <p role="alert" className="billing-error">{error}</p>}
   {activeTab === 0 && <TarifsPanel canWrite={canWrite} busy={busy} run={run} />}
   {activeTab === 1 && <InvoicesPanel canWrite={canWrite} busy={busy} run={run} />}
   {activeTab === 2 && <ExpensesPanel canWrite={canWrite} busy={busy} run={run} />}
   {activeTab === 3 && <SinistresPanel canWrite={canWrite} busy={busy} run={run} />}
   {activeTab === 4 && <FiscalPanel canWrite={canWrite} busy={busy} run={run} />}
   {activeTab === 5 && <section className="panel access-note"><h2>Trésorerie & analyse</h2><p>À venir — tableaux de trésorerie, n8n et Telegram seront branchés plus tard. L’endpoint sécurisé <code>POST /api/billing/integrations/receipt</code> est déjà prêt.</p></section>}
   {toast && <div className="toast" role="status"><Icon name="check" size={18} />{toast}<button onClick={() => setToast('')} aria-label="Fermer">×</button></div>}
  </div>
 );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: 'blue' | 'orange' | 'violet' | 'teal' }) {
 return (
  <div className="billing-kpi">
   <span className={`billing-kpi-icon ${tone}-bg`}><Icon name={icon} size={20} /></span>
   <div><span>{label}</span><strong>{value}</strong></div>
  </div>
 );
}

function TarifsPanel({ canWrite, busy, run }: { canWrite: boolean; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
 const [rates, setRates] = useState<Record<string, unknown>[]>([]);
 const [seasons, setSeasons] = useState<Record<string, unknown>[]>([]);
 const [suggestions, setSuggestions] = useState<Record<string, unknown>[]>([]);
 const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
 const [showSuggestions, setShowSuggestions] = useState(false);
 const [form, setForm] = useState({ category: 'ECONOMIQUE' as VehicleCategory, dailyDt: '100', dateDebut: '', dateFin: '' });

 const load = useCallback(async () => {
  setRates(await billingGet('/tarifs/base-rates'));
  setSeasons(await billingGet('/tarifs/seasons'));
  const next = await billingGet<Record<string, unknown>[]>('/suggestions');
  setSuggestions(next);
  if (next.length) setShowSuggestions(true);
 }, []);
 useEffect(() => { void load().catch(() => undefined); }, [load]);

 return (
  <div className="billing-stack">
   <section className="panel">
    <div className="panel-heading"><div><h3>Tarifs journaliers par catégorie</h3><p>Montants en DT (stockés en millimes). Une nouvelle version conserve l’historique.</p></div></div>
    <div className="billing-body">
     <div className="form-row">
      <label className="field">Catégorie<select value={form.category} disabled={!canWrite} onChange={e => setForm({ ...form, category: e.target.value as VehicleCategory })}>{vehicleCategories.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></label>
      <label className="field">Tarif / jour (DT)<input type="number" step="0.001" value={form.dailyDt} disabled={!canWrite} onChange={e => setForm({ ...form, dailyDt: e.target.value })} /></label>
     </div>
     {canWrite && <div className="billing-footer"><button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => {
      await billingSend('PUT', '/tarifs/base-rates', { category: form.category, dailyMillimes: Math.round(Number(form.dailyDt) * 1000), valideDepuis: new Date().toISOString().slice(0, 10), active: true });
      await load();
     }, 'Tarif enregistré.')}>Enregistrer le tarif</button></div>}
     {rates.length ? (
      <ul className="billing-list">{rates.map(r => <li key={String(r.id)}><strong>{categoryLabels[r.category as VehicleCategory] || String(r.category)}</strong> — {millimesToDt(Number(r.dailyMillimes))} / j · depuis {String(r.valideDepuis)}</li>)}</ul>
     ) : <div className="billing-empty"><Empty text="Aucun tarif encore." /></div>}
    </div>
   </section>

   <section className="panel">
    <div className="panel-heading"><div><h3>Saisons & devis</h3><p>Coefficient en base (1,00 = 10000). VERIFY: à caler sur le calendrier réel. Les dates servent aussi au moteur de devis.</p></div></div>
    <div className="billing-body">
     <div className="form-row">
      <label className="field">Début<input type="date" value={form.dateDebut} disabled={!canWrite} onChange={e => setForm({ ...form, dateDebut: e.target.value })} /></label>
      <label className="field">Fin<input type="date" value={form.dateFin} disabled={!canWrite} onChange={e => setForm({ ...form, dateFin: e.target.value })} /></label>
     </div>
     {canWrite && <div className="billing-footer">
      <button className="btn ghost small-btn" disabled={busy || !form.dateDebut || !form.dateFin} onClick={() => void run(async () => {
       await billingSend('PUT', '/tarifs/seasons', { name: 'Saison', dateDebut: form.dateDebut, dateFin: form.dateFin, coefficientBp: 12000, active: true });
       await load();
      }, 'Saison ajoutée.')}>+ Saison +20 %</button>
      <button className="btn primary small-btn" disabled={busy || !form.dateDebut || !form.dateFin} onClick={() => void run(async () => {
       setQuote(await billingSend('POST', '/quote', { categorie: form.category, dateDebut: form.dateDebut, dateFin: form.dateFin }));
      }, 'Devis calculé.')}>Calculer un devis</button>
     </div>}
     {quote && <div className="billing-quote"><p><strong>{quote.jours as number} j</strong> · total {millimesToDt(Number(quote.total))} · id {String(quote.quoteId || quote.id)}</p>
      <p>Remise durée {String(quote.durationDiscountBp)} bp · partenaire {String(quote.partnerDiscountBp)} bp</p></div>}
     {seasons.length ? (
      <ul className="billing-list">{seasons.map(s => <li key={String(s.id)}>{String(s.name)} · {String(s.dateDebut)} → {String(s.dateFin)} · coef {(Number(s.coefficientBp) / BP_UNIT).toFixed(2)}</li>)}</ul>
     ) : <div className="billing-empty"><Empty text="Aucune saison définie." /></div>}
    </div>
   </section>

   <section className="panel">
    <div className="panel-heading">
     <div><h3>Suggestions de prix</h3><p>Règles explicables — rien ne change sans acceptation.</p></div>
     <div className="billing-actions" style={{ marginTop: 0 }}>
      {canWrite && <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => {
       const next = await billingGet<Record<string, unknown>[]>('/suggestions');
       setSuggestions(next); setShowSuggestions(true);
      }, 'Suggestions actualisées.')}>Actualiser</button>}
      <button className="btn ghost small-btn" onClick={() => setShowSuggestions(v => !v)}>{showSuggestions ? 'Masquer' : 'Afficher'}</button>
     </div>
    </div>
    {showSuggestions && (
     <div className="billing-body">
      {suggestions.length ? (
       <div className="billing-list">{suggestions.map(s => (
        <article key={String(s.id)} className="billing-suggestion">
         <header><strong>{categoryLabels[s.category as VehicleCategory] || String(s.category)}</strong><Badge tone={s.status === 'proposée' ? 'blue' : s.status === 'acceptée' ? 'green' : 'gray'}>{String(s.status)}</Badge></header>
         <p>{String(s.reason)}</p>
         <p>Coef {(Number(s.currentCoefficientBp) / BP_UNIT).toFixed(2)} → {(Number(s.suggestedCoefficientBp) / BP_UNIT).toFixed(2)} · confiance {String(s.confidence)}</p>
         {canWrite && s.status === 'proposée' && (
          <div className="billing-actions">
           <button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => { await billingSend('POST', `/suggestions/${s.id}/decision`, { decision: 'acceptée' }); setSuggestions(await billingGet('/suggestions')); }, 'Suggestion acceptée.')}>Accepter</button>
           <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => { await billingSend('POST', `/suggestions/${s.id}/decision`, { decision: 'refusée' }); setSuggestions(await billingGet('/suggestions')); }, 'Suggestion refusée.')}>Refuser</button>
          </div>
         )}
        </article>
       ))}</div>
      ) : <div className="billing-empty"><Empty text="Aucune suggestion pour l’instant." /></div>}
     </div>
    )}
   </section>
  </div>
 );
}

function InvoicesPanel({ canWrite, busy, run }: { canWrite: boolean; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
 const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
 const [printId, setPrintId] = useState<string | null>(null);
 const [draft, setDraft] = useState({ raisonSociale: '', matriculeFiscal: '', adresse: '', label: 'Prestation', qty: '1', unitDt: '100', dateEcheance: '' });
 const load = useCallback(async () => setInvoices(await billingGet('/invoices')), []);
 useEffect(() => { void load().catch(() => undefined); }, [load]);
 const printInv = invoices.find(i => i.id === printId);

 return (
  <div className="billing-stack">
   <section className="panel">
    <div className="panel-heading"><div><h3>Nouvelle facture (brouillon)</h3><p>Client, échéance et ligne de prestation.</p></div></div>
    <div className="billing-body">
     <div className="form-row">
      <label className="field">Raison sociale<input value={draft.raisonSociale} disabled={!canWrite} onChange={e => setDraft({ ...draft, raisonSociale: e.target.value })} /></label>
      <label className="field">Matricule fiscal<input value={draft.matriculeFiscal} disabled={!canWrite} onChange={e => setDraft({ ...draft, matriculeFiscal: e.target.value })} /></label>
     </div>
     <div className="form-row">
      <label className="field">Adresse<input value={draft.adresse} disabled={!canWrite} onChange={e => setDraft({ ...draft, adresse: e.target.value })} /></label>
      <label className="field">Échéance<input type="date" value={draft.dateEcheance} disabled={!canWrite} onChange={e => setDraft({ ...draft, dateEcheance: e.target.value })} /></label>
     </div>
     <div className="form-row cols-3">
      <label className="field">Libellé de ligne<input value={draft.label} disabled={!canWrite} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>
      <label className="field">Quantité<input type="number" value={draft.qty} disabled={!canWrite} onChange={e => setDraft({ ...draft, qty: e.target.value })} /></label>
      <label className="field">Prix unitaire (DT)<input type="number" step="0.001" value={draft.unitDt} disabled={!canWrite} onChange={e => setDraft({ ...draft, unitDt: e.target.value })} /></label>
     </div>
     {canWrite && <div className="billing-footer"><button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => {
      await billingSend('PUT', '/invoices', {
       raisonSociale: draft.raisonSociale, matriculeFiscal: draft.matriculeFiscal, adresse: draft.adresse, dateEcheance: draft.dateEcheance,
       lines: [{ label: draft.label, quantity: Number(draft.qty), unitPriceMillimes: Math.round(Number(draft.unitDt) * 1000) }],
      });
      await load();
     }, 'Brouillon enregistré.')}>Enregistrer brouillon</button></div>}
    </div>
   </section>
   <section className="panel">
    <div className="panel-heading"><div><h3>Factures</h3><p>Brouillons, émissions et paiements.</p></div></div>
    <div className="billing-body">
     {invoices.length ? (
      <div className="table-scroll"><table><thead><tr><th>N°</th><th>Client</th><th>TTC</th><th>Statut</th><th>Actions</th></tr></thead>
       <tbody>{invoices.map(inv => (
        <tr key={String(inv.id)}>
         <td className="mono">{String(inv.number || '—')}</td>
         <td>{String(inv.raisonSociale)}</td>
         <td>{millimesToDt(Number(inv.totalTTC))}</td>
         <td><Badge tone={inv.status === 'payée' ? 'green' : inv.status === 'en retard' ? 'orange' : 'gray'}>{String(inv.status)}</Badge></td>
         <td className="billing-actions">
          <button className="btn ghost small-btn" onClick={() => setPrintId(String(inv.id))}>Imprimer</button>
          {canWrite && inv.status === 'brouillon' && <button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => { await billingSend('POST', `/invoices/${inv.id}/issue`); await load(); }, 'Facture émise.')}>Émettre</button>}
          {canWrite && ['émise', 'en retard'].includes(String(inv.status)) && <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => {
           const rest = Number(inv.remaining || inv.totalTTC);
           await billingSend('POST', `/invoices/${inv.id}/payments`, { montant: Math.round(rest / 2) || rest, mode: 'virement', date: new Date().toISOString().slice(0, 10) });
           await load();
          }, 'Paiement enregistré.')}>Paiement partiel</button>}
          {canWrite && ['émise', 'en retard', 'payée'].includes(String(inv.status)) && <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => {
           await billingSend('POST', `/invoices/${inv.id}/credit-notes`, { amountMillimes: Math.min(1000, Number(inv.remaining || inv.totalTTC)), motif: 'Geste commercial' });
           await load();
          }, 'Avoir créé.')}>Avoir</button>}
         </td>
        </tr>
       ))}</tbody></table></div>
     ) : <div className="billing-empty"><Empty text="Aucune facture pour le moment." /></div>}
    </div>
   </section>
   {printInv && (
    <Dialog close={() => setPrintId(null)} title="Facture">
     <div className="billing-print">
      <h2>Facture {String(printInv.number || 'brouillon')}</h2>
      <p>{String(printInv.raisonSociale)} · {String(printInv.matriculeFiscal)}</p>
      <p>{String(printInv.adresse)}</p>
      <p>HT {millimesToDt(Number(printInv.totalHT))} · TVA {millimesToDt(Number(printInv.vat))} · Timbre {millimesToDt(Number(printInv.stampMillimes))} · TTC {millimesToDt(Number(printInv.totalTTC))}</p>
      <button className="btn primary" onClick={() => window.print()}>Imprimer</button>
     </div>
    </Dialog>
   )}
  </div>
 );
}

function ExpensesPanel({ canWrite, busy, run }: { canWrite: boolean; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
 const [rows, setRows] = useState<Record<string, unknown>[]>([]);
 const [draft, setDraft] = useState({ fournisseur: '', date: '', categorie: 'autre', montantTTC: '0', tva: '0', montantHT: '0' });
 const [fileName, setFileName] = useState('');
 const load = useCallback(async () => setRows(await billingGet('/expenses')), []);
 useEffect(() => { void load().catch(() => undefined); }, [load]);
 const blobReady = false; // BLOB_READ_WRITE_TOKEN not wired in UI yet — field disabled.
 return (
  <div className="billing-stack">
   <section className="panel">
    <div className="panel-heading"><div><h3>Nouvelle dépense</h3><p>Saisissez le fournisseur et le montant TTC. La validation passe la dépense en comptabilité.</p></div></div>
    <div className="billing-body">
     <div className="billing-note"><Badge tone="orange">Justificatifs</Badge><span className="billing-muted">Upload Vercel Blob désactivé tant que <code>BLOB_READ_WRITE_TOKEN</code> n’est pas configuré.</span></div>
     <div className="form-row">
      <label className="field">Fournisseur<input value={draft.fournisseur} disabled={!canWrite} onChange={e => setDraft({ ...draft, fournisseur: e.target.value })} /></label>
      <label className="field">Date<input type="date" value={draft.date} disabled={!canWrite} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
     </div>
     <div className="form-row">
      <label className="field">Catégorie<select value={draft.categorie} disabled={!canWrite} onChange={e => setDraft({ ...draft, categorie: e.target.value })}>{['pièces', 'réparation', 'carburant', 'assurance', 'achat stock', 'autre'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="field">TTC (DT)<input value={draft.montantTTC} disabled={!canWrite} onChange={e => setDraft({ ...draft, montantTTC: e.target.value })} /></label>
     </div>
     <label className="field">Justificatif
      <div className="billing-file">
       <button type="button" className="btn ghost small-btn" disabled={!blobReady || !canWrite} onClick={() => document.getElementById('billing-expense-file')?.click()}>Joindre un fichier</button>
       <span className="billing-file-name">{fileName || (blobReady ? 'Aucun fichier' : 'Indisponible pour le moment')}</span>
       <input id="billing-expense-file" type="file" disabled={!blobReady || !canWrite} title="Nécessite BLOB_READ_WRITE_TOKEN" onChange={e => setFileName(e.target.files?.[0]?.name || '')} />
      </div>
     </label>
     {canWrite && <div className="billing-footer"><button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => {
      await billingSend('PUT', '/expenses', { ...draft, montantTTC: Math.round(Number(draft.montantTTC) * 1000), tva: Math.round(Number(draft.tva) * 1000), montantHT: Math.round(Number(draft.montantHT) * 1000), status: 'à valider' });
      await load();
     }, 'Dépense ajoutée.')}>Ajouter</button></div>}
    </div>
   </section>

   <section className="panel">
    <div className="panel-heading"><div><h3>Dépenses</h3><p>{rows.length} enregistrement(s)</p></div></div>
    <div className="billing-body">
     {rows.length ? (
      <div className="table-scroll"><table><thead><tr><th>Date</th><th>Fournisseur</th><th>Catégorie</th><th>TTC</th><th>Statut</th><th>Actions</th></tr></thead>
       <tbody>{rows.map(r => (
        <tr key={String(r.id)}>
         <td className="mono">{String(r.date || '—')}</td>
         <td>{String(r.fournisseur)}</td>
         <td>{String(r.categorie || '—')}</td>
         <td>{millimesToDt(Number(r.montantTTC))}</td>
         <td><Badge tone={r.status === 'validée' ? 'green' : 'gray'}>{String(r.status)}</Badge></td>
         <td className="billing-actions">
          {canWrite && r.status !== 'validée' && <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => { await billingSend('POST', `/expenses/${r.id}/status`, { status: 'validée' }); await load(); }, 'Dépense validée.')}>Valider</button>}
         </td>
        </tr>
       ))}</tbody></table></div>
     ) : <div className="billing-empty"><Empty text="Aucune dépense enregistrée." /></div>}
    </div>
   </section>
  </div>
 );
}

function SinistresPanel({ canWrite, busy, run }: { canWrite: boolean; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
 const [rows, setRows] = useState<Record<string, unknown>[]>([]);
 const load = useCallback(async () => setRows(await billingGet('/sinistres')), []);
 useEffect(() => { void load().catch(() => undefined); }, [load]);
 return (
  <section className="panel">
   <div className="panel-heading"><div><h3>Dossiers sinistres (volet financier)</h3></div>
    {canWrite && <button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => {
     await billingSend('PUT', '/sinistres', { date: new Date().toISOString().slice(0, 10), description: 'Nouveau dossier', status: 'ouvert' });
     await load();
    }, 'Dossier ouvert.')}>Nouveau dossier</button>}
   </div>
   <ul className="billing-list">{rows.map(r => (
    <li key={String(r.id)}>
     <strong>{String(r.date)}</strong> — {String(r.description)} · <Badge tone="blue">{String(r.status)}</Badge>
     <div>Coût net agence : {millimesToDt(Number(r.netCost || 0))} (dépenses − indemnités − refacturation payée)</div>
    </li>
   ))}</ul>
  </section>
 );
}

function FiscalPanel({ canWrite, busy, run }: { canWrite: boolean; busy: boolean; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
 const month = new Date().toISOString().slice(0, 7);
 const [vat, setVat] = useState<Record<string, unknown> | null>(null);
 const [settings, setSettings] = useState<{ vatBp: number; stampMillimes: number } | null>(null);
 const [obligations, setObligations] = useState<Record<string, unknown>[]>([]);
 useEffect(() => {
  void billingGet<Record<string, unknown>>(`/fiscal/vat?month=${month}`).then(setVat).catch(() => undefined);
  void billingGet<{ vatBp: number; stampMillimes: number }>('/settings').then(setSettings).catch(() => undefined);
  void billingGet<Record<string, unknown>[]>('/obligations').then(setObligations).catch(() => undefined);
 }, [month]);
 return (
  <div className="billing-stack">
   <section className="panel">
    <div className="panel-heading"><div><h3>Paramètres fiscaux <Badge tone="orange">à vérifier</Badge></h3><p>VERIFY: TVA par défaut 19 %, timbre 1 DT — modifiables.</p></div>
     {canWrite && settings && <button className="btn primary small-btn" disabled={busy} onClick={() => void run(async () => { await billingSend('PUT', '/settings', settings); }, 'Paramètres sauvés.')}>Enregistrer</button>}
    </div>
    {settings && <div className="form-row">
     <label className="field">TVA (bp)<input type="number" value={settings.vatBp} disabled={!canWrite} onChange={e => setSettings({ ...settings, vatBp: Number(e.target.value) })} /></label>
     <label className="field">Timbre (millimes)<input type="number" value={settings.stampMillimes} disabled={!canWrite} onChange={e => setSettings({ ...settings, stampMillimes: Number(e.target.value) })} /></label>
    </div>}
   </section>
   <section className="panel">
    <div className="panel-heading"><div><h3>TVA du mois {month}</h3><p>Collectée − déductible = à payer.</p></div></div>
    {vat && <p className="billing-muted">Collectée {millimesToDt(Number(vat.collected))} − déductible {millimesToDt(Number(vat.deductible))} = <strong>{millimesToDt(Number(vat.payable))}</strong></p>}
   </section>
   <section className="panel">
    <div className="panel-heading"><h3>Obligations</h3>
     {canWrite && <button className="btn ghost small-btn" disabled={busy} onClick={() => void run(async () => {
      await billingSend('PUT', '/obligations', { type: 'TVA', label: 'Déclaration TVA', period: month, dateEcheance: `${month}-28`, status: 'à faire' });
      setObligations(await billingGet('/obligations'));
     }, 'Obligation ajoutée.')}>+ Obligation</button>}
    </div>
    <ul className="billing-list">{obligations.map(o => {
     const overdue = String(o.status) === 'à faire' && String(o.dateEcheance) < new Date().toISOString().slice(0, 10);
     return <li key={String(o.id)} className={overdue ? 'overdue' : ''}>{String(o.label)} · {String(o.dateEcheance)} · {String(o.status)}</li>;
    })}</ul>
   </section>
  </div>
 );
}

export const billingTabs = TABS;
