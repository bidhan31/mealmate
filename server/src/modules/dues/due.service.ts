import { Types } from 'mongoose';
import { GuestMealStatus, MealType, MembershipStatus, CycleStatus, ExpenseCategory, ExpenseStatus } from '../../config/enums';
import { Membership } from '../memberships/membership.model';
import { MonthCycle } from '../monthEnd/monthEnd.model';
import { Meal } from '../meals/meal.model';
import { Expense } from '../expenses/expense.model';
import { Deposit } from '../deposits/deposit.model';
import { Refund } from '../refunds/refund.model';
import { FoodPurchase } from '../foodPurchases/foodPurchase.model';
import { walletService } from '../wallet/wallet.service';

export interface MemberDueRow {
  membershipId: string;
  userId: string;
  userName: string;
  roomId: string | null;
  mealCount: number;
  mealCost: number;
  rentShare: number;
  utilityShare: number;
  utilities: { purpose: string; amount: number }[];
  individualShare: number;
  fixedShare: number;
  charge: number; // fixedShare + mealCost
  deposits: number;
  refunds: number;
  foodPurchases: number; // buyer out-of-pocket, counts toward covering dues
  credit: number; // deposits + foodPurchases - refunds
  carriedOverBalance: number;
  walletBalance: number;
  expensePaid: number;
  expenseUnpaid: number;
  pendingDues: number;
  due: number; // net shortfall (can be negative = advance/surplus)
}

export interface DuesSummary {
  cycle: string;
  mealRate: number;
  homeTotalMeals: number;
  totalFoodPurchases: number;
  totalFixedExpenses: number;
  totalDeposits: number;
  totalRefunds: number;
  activeMemberCount: number;
  members: MemberDueRow[];
}

interface PopulatedUser {
  _id: Types.ObjectId;
  name?: string;
}

interface PopulatedRoom {
  _id: Types.ObjectId;
  name?: string;
}

function getPreviousCycle(cycle: string): string {
  const [y, m] = cycle.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const dueService = {
  /**
   * Independent due calculator. Computes meal rate and per-member dues directly
   * from Meals, FoodPurchases, Expenses, Deposits and Room assignments for a cycle.
   * No dual-entry ledger — direct Deposit/Expense strategy.
   */
  async compute(homeId: Types.ObjectId, cycle: string): Promise<DuesSummary> {
    const members = await Membership.find({ homeId, status: MembershipStatus.Active })
      .populate<{ userId: PopulatedUser }>('userId', 'name')
      .populate<{ roomId: PopulatedRoom | null }>('roomId', 'name')
      .lean();
    const activeMemberCount = members.length;

    // Fetch previous cycle to pull carried over balances
    const prevCycleStr = getPreviousCycle(cycle);
    const prevCycleData = await MonthCycle.findOne({
      homeId,
      cycle: prevCycleStr,
      status: CycleStatus.Closed,
    }).lean();

    const carriedOverByMember = new Map<string, number>();
    if (prevCycleData?.memberSnapshot) {
      for (const snap of prevCycleData.memberSnapshot) {
        carriedOverByMember.set(snap.membershipId, snap.due);
      }
    }

    // Meals per member (normal + approved guest) for the cycle.
    const mealRows = await Meal.aggregate<{ _id: Types.ObjectId; total: number }>([
      {
        $match: {
          homeId,
          cycle,
          $or: [
            { type: MealType.Normal },
            { type: MealType.Guest, guestStatus: GuestMealStatus.Approved },
          ],
        },
      },
      { $group: { _id: '$membershipId', total: { $sum: '$count' } } },
    ]);
    const mealByMember = new Map<string, number>();
    let homeTotalMeals = 0;
    for (const r of mealRows) {
      mealByMember.set(r._id.toString(), r.total);
      homeTotalMeals += r.total;
    }

    // Food purchases: home total (numerator of meal rate) + per-buyer credit.
    const purchaseRows = await FoodPurchase.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { homeId, cycle } },
      { $group: { _id: '$membershipId', total: { $sum: '$totalAmount' } } },
    ]);
    const purchaseByMember = new Map<string, number>();
    let totalFoodPurchases = 0;
    for (const r of purchaseRows) {
      purchaseByMember.set(r._id.toString(), r.total);
      totalFoodPurchases += r.total;
    }

    // Deposits per member.
    const depositRows = await Deposit.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { homeId, cycle } },
      { $group: { _id: '$membershipId', total: { $sum: '$amount' } } },
    ]);
    const depositByMember = new Map<string, number>();
    let totalDeposits = 0;
    for (const r of depositRows) {
      depositByMember.set(r._id.toString(), r.total);
      totalDeposits += r.total;
    }

    // Refunds per member.
    const refundRows = await Refund.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { homeId, cycle } },
      { $group: { _id: '$membershipId', total: { $sum: '$amount' } } },
    ]);
    const refundByMember = new Map<string, number>();
    let totalRefunds = 0;
    for (const r of refundRows) {
      refundByMember.set(r._id.toString(), r.total);
      totalRefunds += r.total;
    }

    // Equally shared expenses
    const equallySharedExpenses = await Expense.find({ homeId, cycle, type: ExpenseCategory.EquallyShared }).lean();
    const totalEquallyShared = equallySharedExpenses.reduce((s, e) => s + e.amount, 0);
    const utilityShare = activeMemberCount > 0 ? totalEquallyShared / activeMemberCount : 0;
    
    // Breakdown of utilities for the frontend
    const utilMap = new Map<string, number>();
    for (const e of equallySharedExpenses) {
      utilMap.set(e.purpose, (utilMap.get(e.purpose) ?? 0) + e.amount);
    }
    const utilitiesList = Array.from(utilMap.entries()).map(([purpose, total]) => ({
      purpose,
      amount: activeMemberCount > 0 ? total / activeMemberCount : 0,
    }));

    // Individual expenses
    const individualExpenses = await Expense.find({ homeId, cycle, type: ExpenseCategory.Individual }).lean();
    const individualExpenseByMember = new Map<string, number>();
    for (const e of individualExpenses) {
      if (e.for) {
        const id = e.for.toString();
        individualExpenseByMember.set(id, (individualExpenseByMember.get(id) ?? 0) + e.amount);
      }
    }

    // Rent: calculated from initialized Rent expenses.
    const rentExpenses = await Expense.find({ homeId, cycle, type: ExpenseCategory.IndependentlyCounted, purpose: 'rent' }).lean();
    const rentExpenseByMember = new Map<string, number>();
    for (const e of rentExpenses) {
      if (e.for) {
        const id = e.for.toString();
        rentExpenseByMember.set(id, (rentExpenseByMember.get(id) ?? 0) + e.amount);
      }
    }

    const walletBalances = await walletService.balancesForHome(homeId);
    const cycleExpenses = await Expense.find({ homeId, cycle }).lean();

    const mealRate = homeTotalMeals > 0 ? totalFoodPurchases / homeTotalMeals : 0;
    
    // Add up all fixed expenses and total house rent for the summary
    const totalIndividual = individualExpenses.reduce((s, e) => s + e.amount, 0);
    const totalHouseRent = rentExpenses.reduce((s, e) => s + e.amount, 0);
    const totalFixedExpenses = totalEquallyShared + totalIndividual + totalHouseRent;

    const rows: MemberDueRow[] = members.map((m) => {
      const id = m._id.toString();
      const mealCount = mealByMember.get(id) ?? 0;
      const mealCost = mealCount * mealRate;
      const rentShare = rentExpenseByMember.get(id) ?? 0;
      const individualShare = individualExpenseByMember.get(id) ?? 0;
      const fixedShare = rentShare + utilityShare + individualShare;
      const charge = fixedShare + mealCost;
      const deposits = depositByMember.get(id) ?? 0;
      const refunds = refundByMember.get(id) ?? 0;
      const foodPurchases = purchaseByMember.get(id) ?? 0;
      const credit = deposits + foodPurchases - refunds;
      const carriedOverBalance = carriedOverByMember.get(id) ?? 0;

      // Expenses assigned to this member (or shared equally)
      const memberExpenses = cycleExpenses.filter(
        (e) => (e.for && e.for.toString() === id) || (!e.for && e.type === ExpenseCategory.EquallyShared),
      );
      const expensePaid = memberExpenses
        .filter((e) => e.status === ExpenseStatus.Paid)
        .reduce((s, e) => s + (e.for ? e.amount : e.amount / activeMemberCount), 0);
      const expenseUnpaid = memberExpenses
        .filter((e) => e.status !== ExpenseStatus.Paid)
        .reduce((s, e) => s + (e.for ? e.amount : e.amount / activeMemberCount), 0);

      const walletBalance = walletBalances.get(id) ?? 0;
      const pendingDues = Math.round(expenseUnpaid + mealCost - foodPurchases);
      // Net due: Unpaid liabilities minus available wallet funds + carryover
      const netDue = Math.round(pendingDues - walletBalance + carriedOverBalance);

      const roomName =
        m.roomId && typeof m.roomId === 'object' && 'name' in m.roomId
          ? (m.roomId as PopulatedRoom).name ?? null
          : m.roomId
          ? String(m.roomId)
          : null;

      return {
        membershipId: id,
        userId: m.userId._id.toString(),
        userName: m.userId.name ?? 'Member',
        roomId: roomName,
        mealCount,
        mealCost: Math.round(mealCost),
        rentShare: Math.round(rentShare),
        utilityShare: Math.round(utilityShare),
        utilities: utilitiesList.map(u => ({ ...u, amount: Math.round(u.amount) })),
        individualShare: Math.round(individualShare),
        fixedShare: Math.round(fixedShare),
        charge: Math.round(charge),
        deposits,
        refunds,
        foodPurchases,
        credit,
        carriedOverBalance,
        walletBalance: Math.round(walletBalance),
        expensePaid: Math.round(expensePaid),
        expenseUnpaid: Math.round(expenseUnpaid),
        pendingDues,
        due: netDue,
      };
    });

    return {
      cycle,
      mealRate: Math.round(mealRate * 100) / 100,
      homeTotalMeals,
      totalFoodPurchases,
      totalFixedExpenses,
      totalDeposits,
      totalRefunds,
      activeMemberCount,
      members: rows,
    };
  },
};
