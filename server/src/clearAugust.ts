import { connectDB, disconnectDB } from './config/db';
import { Meal } from './modules/meals/meal.model';
import { Expense } from './modules/expenses/expense.model';
import { Deposit } from './modules/deposits/deposit.model';
import { Refund } from './modules/refunds/refund.model';
import { FoodPurchase } from './modules/foodPurchases/foodPurchase.model';
import { MonthCycle } from './modules/monthEnd/monthEnd.model';
import { Wallet } from './modules/wallet/wallet.model';
import { WalletTransaction } from './modules/wallet/walletTransaction.model';
import { Home } from './modules/homes/home.model';
import { Payment } from './modules/payments/payment.model';

async function clearAugust() {
  await connectDB();
  console.log('🧹 Clearing all August 2026 data (cycle: "2026-08" / dates starting "2026-08")...');

  const augFilter = { $or: [{ cycle: '2026-08' }, { date: /^2026-08/ }] };

  // 1. Delete Meals, Expenses, Deposits, Refunds, FoodPurchases for August
  const [mealsRes, expRes, depRes, refRes, foodRes, monthRes, payRes] = await Promise.all([
    Meal.deleteMany(augFilter),
    Expense.deleteMany(augFilter),
    Deposit.deleteMany(augFilter),
    Refund.deleteMany(augFilter),
    FoodPurchase.deleteMany(augFilter),
    MonthCycle.deleteMany({ cycle: '2026-08' }),
    Payment.deleteMany({ createdAt: { $gte: new Date('2026-08-01T00:00:00.000Z'), $lt: new Date('2026-09-01T00:00:00.000Z') } }),
  ]);

  console.log(`  - Meals deleted: ${mealsRes.deletedCount}`);
  console.log(`  - Expenses deleted: ${expRes.deletedCount}`);
  console.log(`  - Deposits deleted: ${depRes.deletedCount}`);
  console.log(`  - Refunds deleted: ${refRes.deletedCount}`);
  console.log(`  - Food Purchases deleted: ${foodRes.deletedCount}`);
  console.log(`  - Month Cycles deleted: ${monthRes.deletedCount}`);
  console.log(`  - Payments deleted: ${payRes.deletedCount}`);

  // 2. Delete WalletTransactions created in August or linked to August cycle
  const augTxnRes = await WalletTransaction.deleteMany({
    createdAt: { $gte: new Date('2026-08-01T00:00:00.000Z'), $lt: new Date('2026-09-01T00:00:00.000Z') },
  });
  console.log(`  - Wallet Transactions deleted: ${augTxnRes.deletedCount}`);

  // 3. Reset Home currentCycle to '2026-08' if it was advanced
  const homeRes = await Home.updateMany(
    { currentCycle: { $gte: '2026-08' } },
    { $set: { currentCycle: '2026-08' } },
  );
  console.log(`  - Homes reset to cycle 2026-08: ${homeRes.modifiedCount}`);

  // 4. Re-calculate Wallet balances from remaining ledger transactions
  const wallets = await Wallet.find({});
  for (const wallet of wallets) {
    const txns = await WalletTransaction.find({ walletId: wallet._id });
    let newBalance = 0;
    for (const t of txns) {
      if (t.type === 'credit') {
        newBalance += t.amount;
      } else if (t.type === 'debit') {
        newBalance -= t.amount;
      }
    }
    wallet.balance = Math.max(0, Math.round(newBalance * 100) / 100);
    await wallet.save();
    console.log(`  - Wallet ${wallet.membershipId}: new balance = ৳${wallet.balance}`);
  }

  console.log('✅ August 2026 data successfully cleared and wallet balances recalculated!');
  await disconnectDB();
}

clearAugust().catch((err) => {
  console.error('❌ Clear August error:', err);
  process.exit(1);
});
