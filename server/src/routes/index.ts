import { Router } from 'express';
import { env } from '../config/env';
import authRoutes from '../modules/auth/auth.routes';
import homeRoutes from '../modules/homes/home.routes';
import membershipRoutes from '../modules/memberships/membership.routes';
import roomRoutes from '../modules/rooms/room.routes';
import mealRoutes from '../modules/meals/meal.routes';
import foodPurchaseRoutes from '../modules/foodPurchases/foodPurchase.routes';
import expenseRoutes from '../modules/expenses/expense.routes';
import depositRoutes from '../modules/deposits/deposit.routes';
import paymentRoutes from '../modules/payments/payment.routes';
import walletRoutes from '../modules/wallet/wallet.routes';
import dueRoutes from '../modules/dues/due.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import monthEndRoutes from '../modules/monthEnd/monthEnd.routes';
import auditLogRoutes from '../modules/auditLog/auditLog.routes';
import notificationRoutes from '../modules/notifications/notification.routes';
import essentialRoutes from '../modules/essentials/essential.routes';
import refundRoutes from '../modules/refunds/refund.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    code: 200,
    message: 'OK',
    data: {
      status: 'up',
      env: env.NODE_ENV,
      currency: env.CURRENCY,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/homes', homeRoutes);
router.use('/memberships', membershipRoutes);
router.use('/rooms', roomRoutes);
router.use('/meals', mealRoutes);
router.use('/food-purchases', foodPurchaseRoutes);
router.use('/expenses', expenseRoutes);
router.use('/deposits', depositRoutes);
router.use('/refunds', refundRoutes);
router.use('/payments', paymentRoutes);
router.use('/wallets', walletRoutes);
router.use('/dues', dueRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/month-end', monthEndRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/notifications', notificationRoutes);
router.use('/essentials', essentialRoutes);

export default router;
