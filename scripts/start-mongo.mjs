import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';
const { MongoClient } = mongoose.mongo;

const port = Number(process.env.MONGODB_PORT || 27018);
const dbPath = resolve('.data/mongodb');
await mkdir(dbPath, { recursive: true });
const result = spawnSync(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'fleetpro-rs', '--fork', '--logpath', resolve(dbPath, 'mongod.log')], { encoding: 'utf8' });
if (result.error) throw new Error(`MongoDB n’a pas pu démarrer : ${result.error.message}`);
const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 5000 });
try {
 await client.connect();
 const admin = client.db('admin');
 let configuration;
 try { configuration = await admin.command({ replSetGetConfig: 1 }); }
 catch (error) { if (error.codeName !== 'NotYetInitialized') throw error; }
 if (configuration) {
  if (configuration.config._id !== 'fleetpro-rs') throw new Error('Le port demandé utilise un autre replica set. Choisissez un autre port.');
 } else {
  if (result.status !== 0) throw new Error('Le port est déjà utilisé par un autre MongoDB. Aucun changement effectué.');
  await admin.command({ replSetInitiate: { _id: 'fleetpro-rs', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
 }
 const deadline = Date.now() + 30000;
 while (Date.now() < deadline) {
  const hello = await admin.command({ hello: 1 });
  if (hello.isWritablePrimary) { console.log(`MongoDB prêt : mongodb://127.0.0.1:${port}/fleetpro?replicaSet=fleetpro-rs`); process.exitCode = 0; break; }
  await new Promise(resolve => setTimeout(resolve, 500));
 }
 if (process.exitCode !== 0) throw new Error('MongoDB n’est pas encore primaire. Consultez .data/mongodb/mongod.log.');
} finally { await client.close(); }
