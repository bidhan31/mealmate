import mongoose, { ClientSession } from 'mongoose';

/**
 * Runs `fn` inside a MongoDB transaction and returns its result.
 * Guarantees atomicity for multi-document money movements (wallet + ledger + expense/payment)
 * so balances can never desync or be double-spent under concurrency.
 *
 * Requires a replica set / Atlas (which this project uses). The session is always ended.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
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
