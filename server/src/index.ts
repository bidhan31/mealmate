import http from 'http';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { startDailyMealJob, stopDailyMealJob } from './jobs/dailyMeal.job';
import { startMonthEndReminderJob, stopMonthEndReminderJob } from './jobs/monthEndReminder.job';
import { verifyBrevo } from './utils/mailer';

async function bootstrap(): Promise<void> {
  await connectDB();

  void verifyBrevo();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    
    logger.info(`🚀 MealMate API running on Port  : ${env.PORT} [${env.NODE_ENV}]`);
  });

  startDailyMealJob();
  startMonthEndReminderJob();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);
    stopDailyMealJob();
    stopMonthEndReminderJob();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if still hanging after 10s
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
