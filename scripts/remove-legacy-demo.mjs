import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { seed } from '../tests/fixtures/resources.mjs';
import { planDemoCleanup } from './demo-cleanup-plan.mjs';

// One-time, explicit cleanup; normal application startup never runs this script.
const apply = process.argv.includes('--apply');
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/fleetpro?replicaSet=fleetpro-rs');
try {
 await client.connect();
 const db = client.db();
 if (db.databaseName !== 'fleetpro') throw new Error('This cleanup is restricted to the local FleetPro database.');
 const session = client.startSession();
 try {
  await session.withTransaction(async () => {
   if (apply) await db.collection('resource_revisions').updateOne({ _id: 'resources' }, { $inc: { revision: 1 } }, { session });
   const store = {};
   for (const kind of Object.keys(seed)) store[kind] = await db.collection(kind).find({}, { session }).toArray();
   const plan = planDemoCleanup(store, seed);
   console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', current: Object.fromEntries(Object.entries(store).map(([key, rows]) => [key, rows.length])), removeUnchangedDemo: Object.fromEntries(Object.entries(plan).map(([key, ids]) => [key, ids.length])) }));
   if (!apply || !Object.values(plan).some(ids => ids.length)) return;
   const directory = resolve('.data/backups');
   await mkdir(directory, { recursive: true });
   const backup = resolve(directory, `before-demo-cleanup-${Date.now()}-${randomUUID()}.json`);
   await writeFile(backup, mongoose.mongo.BSON.EJSON.stringify(store, null, 2), { flag: 'wx', mode: 0o600 });
   console.log('Backup:', backup);
   for (const [kind, ids] of Object.entries(plan)) if (ids.length) await db.collection(kind).deleteMany({ id: { $in: ids } }, { session });
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
 } finally { await session.endSession(); }
} finally { await client.close(); }
