import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

let memoryServer: import('mongodb-memory-server').MongoMemoryServer | null = null;

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
      logger.warn('⚠️  Local MongoDB not reachable — starting in-memory server…');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      await mongoose.connect(uri);
      logger.info('✅ MongoDB connected (in-memory — data will not persist across restarts)');
    }
  } else {
    await mongoose.connect(uri);
    logger.info('✅ MongoDB connected');
  }

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
