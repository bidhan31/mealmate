import { connectDB, disconnectDB } from './config/db';
import { Meal } from './modules/meals/meal.model';
import { Expense } from './modules/expenses/expense.model';
import { Deposit } from './modules/deposits/deposit.model';
import { FoodPurchase } from './modules/foodPurchases/foodPurchase.model';
import { MonthCycle } from './modules/monthEnd/monthEnd.model';
import { AuditLog } from './modules/auditLog/auditLog.model';
import { Notification } from './modules/notifications/notification.model';
import { Token } from './modules/auth/token.model';
import { Wallet } from './modules/wallet/wallet.model';
import { WalletTransaction } from './modules/wallet/walletTransaction.model';
import { Payment } from './modules/payments/payment.model';

/**
 * Removes all transactional data while preserving the initial state:
 * Users, Home, Rooms, and Memberships (i.e. the members added to the home).
 */
async function clean() {
  await connectDB();
  console.log('Clearing all transactional data (keeping Home + Memberships + Users + Rooms)...');
  await Promise.all([
    Meal.deleteMany({}),
    Expense.deleteMany({}),
    Deposit.deleteMany({}),
    FoodPurchase.deleteMany({}),
    MonthCycle.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    Token.deleteMany({}),
    Wallet.deleteMany({}),
    WalletTransaction.deleteMany({}),
    Payment.deleteMany({}),
  ]);
  console.log('Clean complete. Home, Memberships, Users, and Rooms preserved in initial state.');
  await disconnectDB();
}

clean().catch((err) => {
  console.error('Clean error:', err);
  process.exit(1);
});
