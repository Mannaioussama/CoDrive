import { mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
const { MongoClient } = mongoose.mongo;

const port = Number(process.env.MONGODB_PORT || 27018);
const dbPath = resolve('.data/mongodb');
const logPath = resolve(dbPath, 'mongod.log');
const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;
await mkdir(dbPath, { recursive: true });

async function tryConnect(timeoutMs) {
 const client = new MongoClient(uri, { serverSelectionTimeoutMS: timeoutMs });
 try {
  await client.connect();
  return client;
 } catch (error) {
  await client.close().catch(() => {});
  throw error;
 }
}

let alreadyUp = false;
let client;
try {
 client = await tryConnect(1500);
 alreadyUp = true;
} catch {
 // MongoDB 8.2 on macOS rejects --fork; start detached with logs to file instead.
 const logFd = await open(logPath, 'a');
 const child = spawn(
  process.env.MONGOD_BINARY || 'mongod',
  ['--dbpath', dbPath, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'fleetpro-rs'],
  { detached: true, stdio: ['ignore', logFd.fd, logFd.fd] },
 );
 child.unref();
 await logFd.close();
 const deadline = Date.now() + 20000;
 for (;;) {
  try {
   client = await tryConnect(2000);
   break;
  } catch (error) {
   if (Date.now() >= deadline) throw new Error(`MongoDB n’a pas pu démarrer : ${error.message}. Consultez ${logPath}`);
   await new Promise(r => setTimeout(r, 400));
  }
 }
}

try {
 const admin = client.db('admin');
 let configuration;
 try { configuration = await admin.command({ replSetGetConfig: 1 }); }
 catch (error) { if (error.codeName !== 'NotYetInitialized') throw error; }
 if (configuration) {
  if (configuration.config._id !== 'fleetpro-rs') throw new Error('Le port demandé utilise un autre replica set. Choisissez un autre port.');
 } else {
  if (alreadyUp) throw new Error('Le port est déjà utilisé par un autre MongoDB. Aucun changement effectué.');
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
