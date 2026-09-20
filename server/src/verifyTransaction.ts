/**
 * Diagnostic: verifies the connected MongoDB accepts multi-document
 * transactions, without going through any business flow.
 *
 * Usage: npm --workspace server run verify:txn
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db';
import { transactionsSupported, withTransaction } from './utils/transaction';

async function main(): Promise<void> {
  await connectDB();

  const supported = await transactionsSupported();
  console.log(`Transaction support probe: ${supported ? 'supported (replica set / mongos)' : 'NOT supported (standalone)'}`);

  const col = mongoose.connection.collection('_txn_selftest');
  const committed = await withTransaction(async (session) => {
    const _id = new mongoose.Types.ObjectId();
    await col.insertOne({ _id, ok: true }, { session });
    const found = await col.findOne({ _id }, { session });
    return found?.ok === true;
  });

  console.log(committed ? '✅ withTransaction round-trip OK' : '❌ Document not visible inside the transaction');
  await col.drop().catch(() => {});

  await disconnectDB();
  process.exitCode = committed ? 0 : 1;
}

main().catch((err) => {
  console.error('verify:txn failed:', err);
  process.exitCode = 1;
});