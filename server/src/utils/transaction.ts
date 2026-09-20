import mongoose, { ClientSession } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Whether the connected MongoDB topology supports multi-document transactions
 * (replica set member or sharded cluster via mongos). Probed once per process.
 */
let transactionSupport: boolean | null = null;
let warnedUnsupported = false;

export async function transactionsSupported(): Promise<boolean> {
  if (transactionSupport !== null) return transactionSupport;
  try {
    const db = mongoose.connection.db;
    if (!db) {
      transactionSupport = false;
      return transactionSupport;
    }
    const hello = await db.admin().command({ hello: 1 });
    // Replica set members report "setName"; sharded proxies (mongos) report msg "isdbgrid".
    transactionSupport = Boolean(hello.setName) || hello.msg === 'isdbgrid';
  } catch (err) {
    // Connection trouble: treat as unsupported, the real error surfaces on use.
    logger.warn({ err }, 'Could not probe MongoDB transaction support');
    transactionSupport = false;
  }
  return transactionSupport;
}

/**
 * Runs `fn` inside a MongoDB transaction and returns its result.
 * Guarantees atomicity for multi-document money movements (wallet + ledger + expense/payment)
 * so balances can never desync or be double-spent under concurrency.
 *
 * Requires a replica set / Atlas (which production uses). On a standalone
 * development server (no replica set) the same code runs without a transaction
 * — statements commit individually — while in production a clear error is
 * thrown instead of silently losing atomicity. The session is always ended.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const supported = await transactionsSupported();
  const session = await mongoose.startSession();
  try {
    if (!supported) {
      if (env.isProd) {
        throw new Error(
          'MongoDB transactions are unavailable: the server is not a replica set member or mongos. ' +
            'Set MONGODB_URI to a replica set (e.g. MongoDB Atlas).',
        );
      }
      if (!warnedUnsupported) {
        warnedUnsupported = true;
        logger.warn(
          '⚠️  Standalone MongoDB detected — running without transaction atomicity. ' +
            'For full behaviour use a replica set locally or set MONGODB_URI to Atlas.',
        );
      }
      return await fn(session);
    }

    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    // result is always assigned because withTransaction awaits fn at least once.
    return result!;
  } finally {
    await session.endSession();
  }
}
