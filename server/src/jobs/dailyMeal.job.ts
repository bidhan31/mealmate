import cron, { ScheduledTask } from 'node-cron';
import { Home } from '../modules/homes/home.model';
import { mealService } from '../modules/meals/meal.service';
import { todayKey } from '../utils/dates';
import { logger } from '../config/logger';

let task: ScheduledTask | null = null ;

/**
 * Runs hourly and, for each home, ensures a zero-count meal row exists for the
 * current day in that home's timezone. This makes it timezone-correct without
 * needing one schedule per zone (idempotent upserts).
 */
export function startDailyMealJob(): void {
  if (task) return;
  task = cron.schedule('5 * * * *', async () => {
    try {
      const homes = await Home.find().select('_id timezone');
      let totalCreated = 0;
      for (const home of homes) {
        const date = todayKey(home.timezone);
        totalCreated += await mealService.ensureDailyMeals(home._id, date);
      }
      if (totalCreated > 0) logger.info(`🍽️ Daily meal job created ${totalCreated} meal rows`);
    } catch (err) {
      logger.error({ err }, 'Daily meal job failed');
    }
  });
  logger.info('⏰ Daily meal cron scheduled (hourly, timezone-aware)');
}

export function stopDailyMealJob(): void {
  task?.stop();
  task = null;
}
