import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';
import { transactionsSupported } from '../utils/transaction';

let memoryServer:
  | import('mongodb-memory-server').MongoMemoryServer
  | import('mongodb-memory-server').MongoMemoryReplSet
  | null = null;

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  if (env.isDev) mongoose.set('debug', false);

  let uri = env.MONGODB_URI;

  // In development, fall back to an in-memory MongoDB if the configured URI
  // points to a local instance that might not be running.
  if (env.isDev && uri.startsWith('mongodb://localhost')) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      logger.info('✅ MongoDB connected (local)');
    } catch {
      logger.warn('⚠️  Local MongoDB not reachable — starting in-memory replica set…');
      // A single-node replica set (not a plain standalone) so multi-document
      // transactions work for Create home / deposits / payments in development.
      // Data is still ephemeral: it does not survive a server restart.
      const { MongoMemoryReplSet } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      uri = memoryServer.getUri();
      await mongoose.connect(uri);
      logger.info('✅ MongoDB connected (in-memory replica set — transactions enabled, data resets on restart)');
    }
  } else {
    await mongoose.connect(uri);
    logger.info('✅ MongoDB connected');
  }

  // Informational: report once whether multi-document transactions are usable
  // (replica set / mongos). Money flows warn again per-flow in dev if not.
  void transactionsSupported()
    .then((supported) =>
      logger.info(
        supported
          ? '🔎 MongoDB transactions: enabled'
          : '🔎 MongoDB transactions: unavailable (standalone) — dev fallback will be used',
      ),
    )
    .catch(() => {});

  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  logger.info('MongoDB disconnected (graceful shutdown)');
}
