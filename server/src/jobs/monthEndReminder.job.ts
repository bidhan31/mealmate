import cron, { ScheduledTask } from 'node-cron';
import { Types } from 'mongoose';
import { Home } from '../modules/homes/home.model';
import { Membership } from '../modules/memberships/membership.model';
import { notificationService } from '../modules/notifications/notification.service';
import { NotificationType, MembershipStatus } from '../config/enums';
import { logger } from '../config/logger';

let task: ScheduledTask | null = null;

/**
 * Runs at 09:00 on the 25th of every month.
 * Notifies all active home members that the month is ending soon
 * and the admin should close the cycle.
 */
export function startMonthEndReminderJob(): void {
  if (task) return;
  task = cron.schedule('0 9 25 * *', async () => {
    try {
      const homes = await Home.find().select('_id currentCycle').lean();
      let notified = 0;
      for (const home of homes) {
        const memberships = await Membership.find({
          homeId: home._id,
          status: MembershipStatus.Active,
        })
          .populate<{ userId: { _id: Types.ObjectId } }>('userId', '_id')
          .lean();

        const userIds = memberships.map((m) => m.userId._id);
        if (userIds.length > 0) {
          await notificationService.createForHomeMembers(
            userIds,
            home._id,
            NotificationType.FoodTurn,
            `Reminder: cycle ${home.currentCycle} ends soon. Admin should close the month.`,
            { cycle: home.currentCycle },
          );
          notified += userIds.length;
        }
      }
      if (notified > 0) {
        logger.info(`📅 Month-end reminder sent to ${notified} user(s) across ${homes.length} home(s)`);
      }
    } catch (err) {
      logger.error({ err }, 'Month-end reminder job failed');
    }
  });
  logger.info('⏰ Month-end reminder cron scheduled (25th of each month at 09:00)');
}

export function stopMonthEndReminderJob(): void {
  task?.stop();
  task = null;
}
