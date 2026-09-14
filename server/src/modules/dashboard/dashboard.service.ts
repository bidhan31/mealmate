import { Types } from 'mongoose';
import { GuestMealStatus, MealType, MembershipStatus, ExpenseCategory, ExpenseStatus, PaymentStatus } from '../../config/enums';
import { Membership } from '../memberships/membership.model';
import { Meal } from '../meals/meal.model';
import { Expense } from '../expenses/expense.model';
import { Deposit } from '../deposits/deposit.model';
import { Payment } from '../payments/payment.model';
import { FoodPurchase } from '../foodPurchases/foodPurchase.model';
import { dueService } from '../dues/due.service';
import { walletService } from '../wallet/wallet.service';
import { paymentService } from '../payments/payment.service';
import { ApiError } from '../../utils/ApiError';

/** A single payable expense instance shown in the dashboard grid. */
export interface DashboardExpenseInstance {
  expenseId: string;
  purpose: string;
  type: ExpenseCategory;
  amount: number;
  status: ExpenseStatus; // unpaid | paid
  paymentId: string | null;
  createdAt?: string;
}

export interface DashboardSummary {
  cycle: string;
  activeMemberCount: number;
  meals: { homeTotal: number; today: number };
  finance: {
    foodPurchases: number;
    expenses: number;
    fixedExpenses: number;
    deposits: number;
    mealRate: number;
    walletBalanceTotal: number;
  };
  dues: { totalOutstanding: number; totalAdvance: number; membersInDue: number };
  expenses: { total: number; paid: number; unpaid: number };
  utilityColumns: string[];
  expenseByType: { type: string; amount: number }[];
  depositTrend: { date: string; amount: number }[];
  members: {
    membershipId: string;
    userName: string;
    // Meal system — DISPLAY ONLY, not settled through the wallet.
    mealCount: number;
    mealCost: number;
    due: number;
    // Wallet — used to settle expenses.
    walletBalance: number;
    // Real per-member expense instances that can be marked paid from the dashboard.
    expenses: DashboardExpenseInstance[];
    expenseTotal: number;
    expensePaid: number;
    expenseUnpaid: number;
  }[];
}

export const dashboardService = {
  async summary(
    homeId: Types.ObjectId,
    todayKey: string,
    cycle: string,
  ): Promise<DashboardSummary> {
    const [activeMemberCount, mealAgg, todayAgg, purchaseAgg, expenseAgg, depositAgg, expenseByTypeAgg, depositTrendAgg, dues] =
      await Promise.all([
        Membership.countDocuments({ homeId, status: MembershipStatus.Active }),
        Meal.aggregate<{ total: number }>([
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
          { $group: { _id: null, total: { $sum: '$count' } } },
        ]),
        Meal.aggregate<{ total: number }>([
          {
            $match: {
              homeId,
              date: todayKey,
              $or: [
                { type: MealType.Normal },
                { type: MealType.Guest, guestStatus: GuestMealStatus.Approved },
              ],
            },
          },
          { $group: { _id: null, total: { $sum: '$count' } } },
        ]),
        FoodPurchase.aggregate<{ total: number }>([
          { $match: { homeId, cycle } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Expense.aggregate<{ total: number; fixed: number }>([
          { $match: { homeId, cycle } },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' },
              fixed: { $sum: { $cond: [{ $ne: ['$type', ExpenseCategory.IndependentlyCounted] }, '$amount', 0] } },
            },
          },
        ]),
        Deposit.aggregate<{ total: number }>([
          { $match: { homeId, cycle } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate<{ _id: string; amount: number }>([
          { $match: { homeId, cycle } },
          { $group: { _id: '$type', amount: { $sum: '$amount' } } },
          { $sort: { amount: -1 } },
        ]),
        Deposit.aggregate<{ _id: string; amount: number }>([
          { $match: { homeId, cycle } },
          { $group: { _id: '$date', amount: { $sum: '$amount' } } },
          { $sort: { _id: 1 } },
        ]),
        dueService.compute(homeId, cycle),
      ]);

    const totalOutstanding = dues.members
      .filter((m) => m.due > 0)
      .reduce((s, m) => s + m.due, 0);
    const totalAdvance = dues.members
      .filter((m) => m.due < 0)
      .reduce((s, m) => s + Math.abs(m.due), 0);
    const membersInDue = dues.members.filter((m) => m.due > 0).length;

    // Real per-member expense instances for this cycle (the payable items).
    const cycleExpenses = await Expense.find({ homeId, cycle }).lean();
    const expensesByMember = new Map<string, DashboardExpenseInstance[]>();
    for (const e of cycleExpenses) {
      if (!e.for) continue;
      const key = e.for.toString();
      const list = expensesByMember.get(key) ?? [];
      list.push({
        expenseId: e._id.toString(),
        purpose: e.purpose,
        type: e.type,
        amount: e.amount,
        status: e.status,
        paymentId: e.paymentId ? e.paymentId.toString() : null,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : undefined,
      });
      expensesByMember.set(key, list);
    }

    const expenseTotalAll = cycleExpenses.reduce((s, e) => s + e.amount, 0);
    const expensePaidAll = cycleExpenses
      .filter((e) => e.status === ExpenseStatus.Paid)
      .reduce((s, e) => s + e.amount, 0);

    // Wallet balances (global/persistent) for every member in the home.
    const walletBalances = await walletService.balancesForHome(homeId);
    const walletBalanceTotal = Array.from(walletBalances.values()).reduce((s, v) => s + v, 0);

    return {
      cycle,
      activeMemberCount,
      meals: {
        homeTotal: mealAgg[0]?.total ?? 0,
        today: todayAgg[0]?.total ?? 0,
      },
      finance: {
        foodPurchases: purchaseAgg[0]?.total ?? 0,
        expenses: expenseAgg[0]?.total ?? 0,
        fixedExpenses: expenseAgg[0]?.fixed ?? 0,
        deposits: depositAgg[0]?.total ?? 0,
        mealRate: dues.mealRate,
        walletBalanceTotal,
      },
      dues: { totalOutstanding, totalAdvance, membersInDue },
      expenses: {
        total: expenseTotalAll,
        paid: expensePaidAll,
        unpaid: expenseTotalAll - expensePaidAll,
      },
      utilityColumns: Array.from(new Set(dues.members.flatMap(m => m.utilities.map(u => u.purpose)))),
      expenseByType: expenseByTypeAgg.map((e) => ({ type: e._id, amount: e.amount })),
      depositTrend: depositTrendAgg.map((d) => ({ date: d._id, amount: d.amount })),
      members: dues.members.map((m) => {
        const memberExpenses = expensesByMember.get(m.membershipId) ?? [];
        const expenseTotal = memberExpenses.reduce((s, e) => s + e.amount, 0);
        const expensePaid = memberExpenses
          .filter((e) => e.status === ExpenseStatus.Paid)
          .reduce((s, e) => s + e.amount, 0);
        return {
          membershipId: m.membershipId,
          userName: m.userName,
          mealCount: m.mealCount,
          mealCost: m.mealCost,
          due: m.due,
          walletBalance: walletBalances.get(m.membershipId) ?? 0,
          expenses: memberExpenses,
          expenseTotal,
          expensePaid,
          expenseUnpaid: expenseTotal - expensePaid,
        };
      }),
    };
  },

  /**
   * Dashboard mark-paid: the ONLY entry point that flips an expense to paid.
   * Delegates to the payment engine which checks wallet funds and creates a
   * paid or rejected Payment atomically. `isPaid=false` reverses an existing payment.
   */
  async markPaid(
    homeId: Types.ObjectId,
    actor: { id: Types.ObjectId; userId: Types.ObjectId; name: string },
    expenseId: string,
    isPaid: boolean,
  ) {
    if (isPaid) {
      const result = await paymentService.payExpense(homeId, actor, expenseId);
      if (result.rejected) {
        return {
          success: false,
          rejected: true,
          status: PaymentStatus.Rejected,
          reason: result.payment.reason,
          balance: result.balance,
          expenseId,
        };
      }
      return {
        success: true,
        rejected: false,
        status: PaymentStatus.Paid,
        paymentId: result.payment._id.toString(),
        expenseId,
      };
    }

    // Un-mark: reverse the active paid payment for this expense.
    const expense = await Expense.findOne({ _id: new Types.ObjectId(expenseId), homeId }).lean();
    if (!expense) throw ApiError.notFound('Expense not found');
    if (!expense.paymentId) {
      throw ApiError.badRequest('This expense has no active payment to reverse');
    }
    await paymentService.reverse(homeId, actor, expense.paymentId.toString(), 'Un-marked from dashboard');
    return { success: true, rejected: false, status: 'reversed', expenseId };
  },
};
