import { connectDB, disconnectDB } from './config/db';
import { User } from './modules/users/user.model';
import { Home } from './modules/homes/home.model';
import { Room } from './modules/rooms/room.model';
import { Membership } from './modules/memberships/membership.model';
import { Meal } from './modules/meals/meal.model';
import { Expense } from './modules/expenses/expense.model';
import { Deposit } from './modules/deposits/deposit.model';
import { Wallet } from './modules/wallet/wallet.model';
import { WalletTransaction } from './modules/wallet/walletTransaction.model';
import { FoodPurchase } from './modules/foodPurchases/foodPurchase.model';
import { MonthCycle } from './modules/monthEnd/monthEnd.model';
import { ExpenseCategory, Role, MembershipStatus, MealType, MealSlot, DepositType, GuestMealStatus } from './config/enums';
import { monthEndService } from './modules/monthEnd/monthEnd.service';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function seed() {
  await connectDB();
  console.log('Clearing old data...');
  await Promise.all([
    User.deleteMany({}),
    Home.deleteMany({}),
    Room.deleteMany({}),
    Membership.deleteMany({}),
    Meal.deleteMany({}),
    Expense.deleteMany({}),
    Deposit.deleteMany({}),
    Wallet.deleteMany({}),
    WalletTransaction.deleteMany({}),
    FoodPurchase.deleteMany({}),
    MonthCycle.deleteMany({}),
    mongoose.model('AuditLog').deleteMany({}),
    mongoose.model('Notification').deleteMany({}),
  ]);

  console.log('Creating 10 users...');
  const usersData = Array.from({ length: 10 }).map((_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    password: 'password123',
    emailVerified: true,
  }));

  const createdUsers = [];
  for (const u of usersData) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      emailVerified: u.emailVerified,
    });
    createdUsers.push(user);
  }

  console.log('Creating home...');
  const adminUser = createdUsers[0];
  const startCycle = '2026-05';
  const home = await Home.create({
    name: 'Sweet Home',
    adminUserId: adminUser._id,
    inviteCode: generateInviteCode(),
    currentCycle: startCycle,
    expenseTypes: [
      { name: 'Water', category: ExpenseCategory.EquallyShared, defaultAmount: 1000 },
      { name: 'Internet', category: ExpenseCategory.EquallyShared, defaultAmount: 1500 },
      { name: 'Electricity', category: ExpenseCategory.EquallyShared, defaultAmount: 3000 },
      { name: 'Gas', category: ExpenseCategory.EquallyShared, defaultAmount: 1200 },
      { name: 'Garage', category: ExpenseCategory.Individual, defaultAmount: 500 },
      { name: 'Cleaning', category: ExpenseCategory.EquallyShared, defaultAmount: 800 },
    ],
  });

  console.log('Creating 4 rooms...');
  const rooms = await Room.insertMany([
    { homeId: home._id, name: 'Room 1', totalRent: 5000 },
    { homeId: home._id, name: 'Room 2', totalRent: 6000 },
    { homeId: home._id, name: 'Room 3', totalRent: 5500 },
    { homeId: home._id, name: 'Room 4', totalRent: 6500 },
  ]);

  console.log('Creating memberships...');
  const memberships = [];
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const roomId = rooms[i % 4]._id;
    const membership = await Membership.create({
      userId: user._id,
      homeId: home._id,
      roomId,
      role: i === 0 ? Role.Admin : Role.Member,
      status: MembershipStatus.Active,
      joinedAt: new Date(2026, 4, 1),
    });
    memberships.push(membership);
    await User.updateOne({ _id: user._id }, { activeMembershipId: membership._id });
  }

  const cyclesToSeed = ['2026-05', '2026-06', '2026-07'];

  for (let cIdx = 0; cIdx < cyclesToSeed.length; cIdx++) {
    const cycle = cyclesToSeed[cIdx];
    console.log(`Seeding data for cycle ${cycle}...`);
    
    // Set home cycle to allow operations
    home.currentCycle = cycle;
    await home.save();

    const year = parseInt(cycle.split('-')[0]);
    const month = parseInt(cycle.split('-')[1]);
    const daysInMonth = new Date(year, month, 0).getDate();

    const mealsToInsert = [];
    const expensesToInsert = [];
    const depositsToInsert = [];
    const foodPurchasesToInsert = [];

    // Daily Generation
    for (let day = 1; day <= (cIdx === 2 ? 25 : daysInMonth); day++) {
      const dateStr = `${cycle}-${String(day).padStart(2, '0')}`;

      // 1. Daily Meals for everyone
      for (const mb of memberships) {
        let count = 2;
        const r = Math.random();
        if (r < 0.1) count = 0;
        else if (r < 0.3) count = 1;
        else if (r > 0.8) count = 3;

        mealsToInsert.push({
          homeId: home._id,
          membershipId: mb._id,
          type: MealType.Normal,
          date: dateStr,
          count: count,
          cycle,
          createdBy: mb._id,
        });
      }

      // 2. Random Guest Meals
      if (Math.random() < 0.2) {
        const randomMember = memberships[Math.floor(Math.random() * memberships.length)];
        const guestSlots = [MealSlot.Breakfast, MealSlot.Lunch, MealSlot.Dinner];
        mealsToInsert.push({
          homeId: home._id,
          membershipId: randomMember._id,
          requestedByMembershipId: randomMember._id,
          type: MealType.Guest,
          slot: guestSlots[Math.floor(Math.random() * guestSlots.length)],
          guestStatus: GuestMealStatus.Approved,
          date: dateStr,
          count: Math.floor(Math.random() * 3) + 1,
          cycle,
          createdBy: randomMember._id,
        });
      }

      // 3. Food Purchases
      if (day % 4 === 1) {
        const purchaser = memberships[Math.floor(Math.random() * memberships.length)];
        const amount = Math.floor(Math.random() * 2000) + 1500;
        foodPurchasesToInsert.push({
          homeId: home._id,
          membershipId: purchaser._id,
          date: dateStr,
          totalAmount: amount,
          cycle,
          items: [
            { name: 'Vegetables', qty: 1, price: Math.floor(amount * 0.4) },
            { name: 'Meat/Fish', qty: 1, price: Math.floor(amount * 0.6) },
          ],
        });
      }
    }

    // 4. Monthly Shared Expenses
    expensesToInsert.push({ homeId: home._id, createdBy: memberships[0]._id, purpose: 'Water', type: ExpenseCategory.EquallyShared, amount: 1000, date: `${cycle}-05`, cycle });
    expensesToInsert.push({ homeId: home._id, createdBy: memberships[0]._id, purpose: 'Internet', type: ExpenseCategory.EquallyShared, amount: 1500, date: `${cycle}-10`, cycle });
    expensesToInsert.push({ homeId: home._id, createdBy: memberships[0]._id, purpose: 'Electricity', type: ExpenseCategory.EquallyShared, amount: 2500 + Math.floor(Math.random() * 1000), date: `${cycle}-15`, cycle });
    expensesToInsert.push({ homeId: home._id, createdBy: memberships[0]._id, purpose: 'Gas', type: ExpenseCategory.EquallyShared, amount: 1200, date: `${cycle}-20`, cycle });
    
    // 5. Rent Initialization (Simulate Admin clicking Initialize Rent)
    for (const room of rooms) {
      const roomMembers = memberships.filter(m => m.roomId?.toString() === room._id.toString());
      if (roomMembers.length > 0) {
        const rentPerMember = room.totalRent / roomMembers.length;
        for (const member of roomMembers) {
          expensesToInsert.push({
            homeId: home._id,
            createdBy: memberships[0]._id,
            for: member._id,
            purpose: 'rent',
            type: ExpenseCategory.IndependentlyCounted,
            amount: rentPerMember,
            date: `${cycle}-01`,
            cycle,
          });

          // Simulate an initial wallet deposit for the member
          if (Math.random() > 0.1 || cIdx !== 2) {
            depositsToInsert.push({
              homeId: home._id,
              membershipId: member._id,
              depositType: DepositType.Cash,
              amount: rentPerMember,
              date: `${cycle}-02`,
              cycle,
              createdBy: memberships[0]._id,
            });
          }
        }
      }
    }

    // 6. Individual Expenses and General Deposits
    for (let mIdx = 0; mIdx < memberships.length; mIdx++) {
      const mb = memberships[mIdx];
      
      if (mIdx % 2 === 0) {
        expensesToInsert.push({
          homeId: home._id,
          createdBy: memberships[0]._id,
          for: mb._id,
          purpose: 'Garage',
          type: ExpenseCategory.Individual,
          amount: 500,
          date: `${cycle}-01`,
          cycle,
        });
      }

      // General deposit into the member's wallet to cover expenses
      // For the current month, maybe someone hasn't paid yet
      if (cIdx < 2 || Math.random() > 0.3) {
        depositsToInsert.push({
          homeId: home._id,
          membershipId: mb._id,
          depositType: DepositType.Bank,
          amount: Math.floor(Math.random() * 3000) + 3000,
          date: `${cycle}-05`,
          cycle,
          createdBy: memberships[0]._id,
        });
      }
    }

    await Meal.insertMany(mealsToInsert);
    await Expense.insertMany(expensesToInsert);
    await Deposit.insertMany(depositsToInsert);
    await FoodPurchase.insertMany(foodPurchasesToInsert);

    // If it's a past month, close it to generate carryover dues
    if (cIdx < 2) {
      console.log(`Closing month ${cycle}...`);
      await monthEndService.close(home._id, cycle, memberships[0]._id, 'Admin');
    }
  }

  // Build wallets + ledger from all seeded deposits (mirrors depositService.create).
  console.log('Building wallets from deposits...');
  const allDeposits = await Deposit.find({}).lean();
  const balanceByMember = new Map<string, { homeId: mongoose.Types.ObjectId; balance: number }>();
  const txnDocs = [];
  // Deterministic order so balanceAfter is coherent.
  allDeposits.sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const d of allDeposits) {
    const key = d.membershipId.toString();
    const prev = balanceByMember.get(key) ?? { homeId: d.homeId, balance: 0 };
    const balanceAfter = Math.round((prev.balance + d.amount) * 100) / 100;
    balanceByMember.set(key, { homeId: d.homeId, balance: balanceAfter });
  }
  const walletDocs = Array.from(balanceByMember.entries()).map(([membershipId, v]) => ({
    homeId: v.homeId,
    membershipId: new mongoose.Types.ObjectId(membershipId),
    balance: v.balance,
  }));
  const createdWallets = await Wallet.insertMany(walletDocs);
  const walletIdByMember = new Map(createdWallets.map((w) => [w.membershipId.toString(), w._id]));
  // Recompute running balances to record ledger entries + link deposits.
  const runningByMember = new Map<string, number>();
  for (const d of allDeposits) {
    const key = d.membershipId.toString();
    const running = Math.round(((runningByMember.get(key) ?? 0) + d.amount) * 100) / 100;
    runningByMember.set(key, running);
    txnDocs.push({
      homeId: d.homeId,
      membershipId: d.membershipId,
      walletId: walletIdByMember.get(key),
      type: 'credit',
      amount: d.amount,
      balanceAfter: running,
      source: 'deposit',
      refModel: 'Deposit',
      refId: d._id,
      note: 'Deposit',
      createdBy: d.createdBy,
      createdAt: new Date(`${d.date}T00:00:00Z`),
    });
  }
  const createdTxns = await WalletTransaction.insertMany(txnDocs);
  // Link each deposit to its ledger entry.
  for (const t of createdTxns) {
    if (t.refId) await Deposit.updateOne({ _id: t.refId }, { walletTxnId: t._id });
  }

  console.log('Seed completed with realistic 3-month data!');
  await disconnectDB();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

