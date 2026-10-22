#!/usr/bin/env node
/**
 * Opt-in demo seed for Comptabilité price suggestions.
 * Never runs automatically. Refuses a non-empty billing DB unless --force.
 *
 * Usage: node scripts/seed-demo-billing.mjs [--force]
 * Env: MONGODB_URI (default local replica set)
 */
import mongoose from 'mongoose';

const force = process.argv.includes('--force');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/fleetpro?replicaSet=fleetpro-rs';
const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
await client.connect();
const db = client.db();

const collections = ['billing_base_rates', 'billing_seasons', 'billing_demand_signals', 'billing_price_suggestions'];
let nonempty = false;
for (const name of collections) {
 if (await db.collection(name).countDocuments() > 0) nonempty = true;
}
if (nonempty && !force) {
 console.error('Billing collections already have data. Pass --force to overwrite demo seeds.');
 process.exitCode = 1;
 await client.close();
 process.exit();
}

if (force) {
 for (const name of collections) await db.collection(name).deleteMany({});
}

const categories = ['ECONOMIQUE', 'COMPACTE', 'BERLINE', 'SUV', 'PREMIUM', 'UTILITAIRE'];
const rates = categories.map((category, i) => ({
 id: `demo-rate-${category}`,
 category,
 dailyMillimes: (80 + i * 20) * 1000,
 valideDepuis: '2026-01-01',
 active: true,
}));
await db.collection('billing_base_rates').insertMany(rates);

await db.collection('billing_seasons').insertOne({
 id: 'demo-season-ete',
 name: 'Été démo',
 dateDebut: '2026-07-01',
 dateFin: '2026-08-31',
 coefficientBp: 12000,
 active: true,
});

const signals = [];
for (let i = 0; i < 40; i++) {
 const d = new Date(Date.UTC(2026, 0, 1 + i));
 const date = d.toISOString().slice(0, 10);
 for (const categorie of ['ECONOMIQUE', 'SUV']) {
  signals.push({
   categorie,
   date,
   reservations: categorie === 'ECONOMIQUE' ? 9 : 2,
   vehiculesDisponibles: 10,
  });
 }
}
await db.collection('billing_demand_signals').insertMany(signals);

console.log(`Seeded ${rates.length} rates, 1 season, ${signals.length} demand signals into ${uri}`);
await client.close();
