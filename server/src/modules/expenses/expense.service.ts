import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ExpenseCategory, ExpenseStatus, MembershipStatus, NotificationType, Role } from '../../config/enums';
import { Expense } from './expense.model';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { Membership } from '../memberships/membership.model';
import { Room } from '../rooms/room.model';
import { notificationService } from '../notifications/notification.service';

async function computeMemberExpenseSummaries(homeId: Types.ObjectId, cycle: string) {
  const activeMembers = await Membership.find({ homeId, status: MembershipStatus.Active })
    .populate<{ userId: { name?: string } }>('userId', 'name')
    .lean();

  const cycleExpenses = await Expense.find({ homeId, cycle }).lean();

  return activeMembers.map((m) => {
    const mid = m._id.toString();
    const uName = (m.userId as { name?: string })?.name ?? 'Member';

    const mExpenses = cycleExpenses.filter((e) => e.for && e.for.toString() === mid);

    const total = mExpenses.reduce((s, e) => s + e.amount, 0);
    const paid = mExpenses
      .filter((e) => e.status === ExpenseStatus.Paid)
      .reduce((s, e) => s + e.amount, 0);
    const unpaid = total - paid;

    const rent = mExpenses
      .filter((e) => e.type === ExpenseCategory.IndependentlyCounted)
      .reduce((s, e) => s + e.amount, 0);
    const shared = mExpenses
      .filter((e) => e.type === ExpenseCategory.EquallyShared)
      .reduce((s, e) => s + e.amount, 0);
    const individual = mExpenses
      .filter((e) => e.type === ExpenseCategory.Individual)
      .reduce((s, e) => s + e.amount, 0);

    return {
      membershipId: mid,
      userName: uName,
      total: Math.round(total * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      unpaid: Math.round(unpaid * 100) / 100,
      rent: Math.round(rent * 100) / 100,
      shared: Math.round(shared * 100) / 100,
      individual: Math.round(individual * 100) / 100,
    };
  });
}

export const expenseService = {
  async create(
    homeId: Types.ObjectId,
    createdBy: Types.ObjectId,
    data: {
      purpose: string;
      type: ExpenseCategory;
      amount: number;
      cycle: string;
      for?: string | null;
      note?: string;
    },
  ) {
    await monthEndService.assertCycleIsOpen(homeId, data.cycle);
    const date = `${data.cycle}-01`;

    const expense = await Expense.create({
      homeId,
      createdBy,
      for: data.for ? new Types.ObjectId(data.for) : null,
      purpose: data.purpose,
      type: data.type,
      amount: data.amount,
      date,
      cycle: data.cycle,
      note: data.note,
    });

    if (data.for) {
      Membership.findById(data.for).then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId,
            type: NotificationType.NewExpenseAdded,
            message: `A new expense (${data.purpose}) of BDT ${data.amount} was assigned to you.`,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return { expense };
  },

  /**
   * List expenses.
   *  - Members: ONLY their own assigned instances (server-enforced scoping).
   *  - Admins: all expenses for the home/cycle.
   */
  async list(
    homeId: Types.ObjectId,
    viewer: { membershipId: Types.ObjectId; role: Role },
    cycle?: string,
  ) {
    const filter: Record<string, unknown> = { homeId };
    if (cycle) filter.cycle = cycle;
    if (viewer.role !== Role.Admin) {
      // A member can only ever see expenses assigned to them.
      filter.for = viewer.membershipId;
    }
    const expenses = await Expense.find(filter)
      .populate({ path: 'for', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ date: -1 })
      .lean();
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const paidTotal = expenses
      .filter((e) => e.status === ExpenseStatus.Paid)
      .reduce((s, e) => s + e.amount, 0);
    const unpaidTotal = total - paidTotal;
    const fixedTotal = expenses
      .filter((e) => e.type !== ExpenseCategory.IndependentlyCounted)
      .reduce((s, e) => s + e.amount, 0);
    const byMember = cycle ? await computeMemberExpenseSummaries(homeId, cycle) : [];
    return { total, paidTotal, unpaidTotal, fixedTotal, byMember, expenses };
  },

  /**
   * Admin-only expense management view: all expenses for a cycle grouped by category,
   * each with owner + status, plus per-category and overall paid/unpaid totals.
   */
  async manage(homeId: Types.ObjectId, cycle: string) {
    const expenses = await Expense.find({ homeId, cycle })
      .populate({ path: 'for', select: 'userId', populate: { path: 'userId', select: 'name' } })
      .sort({ purpose: 1, date: -1 })
      .lean();

    const categories = Object.values(ExpenseCategory).map((type) => {
      const items = expenses.filter((e) => e.type === type);
      const total = items.reduce((s, e) => s + e.amount, 0);
      const paid = items
        .filter((e) => e.status === ExpenseStatus.Paid)
        .reduce((s, e) => s + e.amount, 0);
      return {
        type,
        count: items.length,
        total,
        paid,
        unpaid: total - paid,
        items,
      };
    });

    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const paid = expenses
      .filter((e) => e.status === ExpenseStatus.Paid)
      .reduce((s, e) => s + e.amount, 0);
    const byMember = await computeMemberExpenseSummaries(homeId, cycle);

    return {
      cycle,
      total,
      paid,
      unpaid: total - paid,
      paidCount: expenses.filter((e) => e.status === ExpenseStatus.Paid).length,
      unpaidCount: expenses.filter((e) => e.status !== ExpenseStatus.Paid).length,
      byMember,
      categories,
    };
  },

  async initializeRent(homeId: Types.ObjectId, createdBy: Types.ObjectId, cycle: string) {
    await monthEndService.assertCycleIsOpen(homeId, cycle);
    const date = `${cycle}-01`;

    // Check if rent is already initialized
    const existingRent = await Expense.findOne({ homeId, cycle, purpose: 'rent' }).lean();
    if (existingRent) {
      throw ApiError.badRequest('Rent due has already been initialized for this month.');
    }

    // 1. Get all rooms for the home
    const rooms = await Room.find({ homeId }).lean();
    if (!rooms.length) throw ApiError.badRequest('No rooms found in the home');

    // 2. Get active members with assigned rooms
    const activeMembers = await Membership.find({ 
      homeId, 
      status: MembershipStatus.Active,
      roomId: { $ne: null }
    }).lean();

    if (!activeMembers.length) throw ApiError.badRequest('No active members with assigned rooms');

    // 3. Calculate rent per member (room.totalRent / members in room)
    const docs = [];
    for (const room of rooms) {
      const roomMembers = activeMembers.filter(m => m.roomId?.toString() === room._id.toString());
      if (roomMembers.length > 0) {
        const rentPerMember = room.totalRent / roomMembers.length;
        for (const member of roomMembers) {
          docs.push({
            homeId,
            createdBy,
            for: member._id,
            purpose: 'rent',
            type: ExpenseCategory.IndependentlyCounted,
            amount: rentPerMember,
            date,
            cycle,
          });
        }
      }
    }

    const expenses = await Expense.insertMany(docs);

    const userIds = activeMembers.map((m) => m.userId as Types.ObjectId);
    notificationService.createForHomeMembers(
      userIds,
      homeId,
      NotificationType.NewExpenseAdded,
      `Monthly Rent expenses have been initialized for ${cycle}.`,
    ).catch(() => {});

    return { expenses };
  },

  async initializeShared(
    homeId: Types.ObjectId,
    createdBy: Types.ObjectId,
    cycle: string,
    expensesData: { purpose: string; amount: number }[]
  ) {
    await monthEndService.assertCycleIsOpen(homeId, cycle);
    const date = `${cycle}-01`;

    const activeMembers = await Membership.find({ homeId, status: MembershipStatus.Active }).lean();
    if (!activeMembers.length) throw ApiError.badRequest('No active members to share expenses');

    const docs = [];
    for (const data of expensesData) {
      const amountPerMember = data.amount / activeMembers.length;
      for (const member of activeMembers) {
        docs.push({
          homeId,
          createdBy,
          for: member._id,
          purpose: data.purpose,
          type: ExpenseCategory.EquallyShared,
          amount: amountPerMember,
          date,
          cycle,
        });
      }
    }

    const expenses = await Expense.insertMany(docs);

    const userIds = activeMembers.map((m) => m.userId as Types.ObjectId);
    notificationService.createForHomeMembers(
      userIds,
      homeId,
      NotificationType.NewExpenseAdded,
      `Shared utility expenses have been initialized for ${cycle}.`,
    ).catch(() => {});

    return { expenses };
  },

  async initializeIndividual(
    homeId: Types.ObjectId,
    createdBy: Types.ObjectId,
    cycle: string,
    data: { purpose: string; amount: number; for: string }
  ) {
    await monthEndService.assertCycleIsOpen(homeId, cycle);
    const date = `${cycle}-01`;

    const expense = await Expense.create({
      homeId,
      createdBy,
      for: new Types.ObjectId(data.for),
      purpose: data.purpose,
      type: ExpenseCategory.Individual,
      amount: data.amount,
      date,
      cycle,
    });

    Membership.findById(data.for).then((m) => {
      if (m) {
        notificationService.create({
          userId: m.userId as Types.ObjectId,
          homeId,
          type: NotificationType.NewExpenseAdded,
          message: `An individual expense (${data.purpose}) of BDT ${data.amount} was assigned to you.`,
        }).catch(() => {});
      }
    }).catch(() => {});

    return { expenses: [expense] };
  },

  /** Edit an unpaid expense's amount / purpose / note. Paid expenses must be reversed first. */
  async update(
    homeId: Types.ObjectId,
    id: string,
    data: { amount?: number; purpose?: string; note?: string },
  ) {
    const expense = await Expense.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!expense) throw ApiError.notFound('Expense not found');
    if (data.amount === undefined && data.purpose === undefined && data.note === undefined) {
      throw ApiError.badRequest('At least one field is required');
    }
    await monthEndService.assertCycleIsOpen(homeId, expense.cycle);
    if (expense.status === ExpenseStatus.Paid) {
      throw ApiError.conflict('This expense is paid. Reverse its payment before editing it.');
    }
    if (data.amount !== undefined) expense.amount = data.amount;
    if (data.purpose !== undefined) expense.purpose = data.purpose;
    if (data.note !== undefined) expense.note = data.note;
    await expense.save();
    return { expense };
  },

  async remove(homeId: Types.ObjectId, id: string) {
    const expense = await Expense.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!expense) throw ApiError.notFound('Expense not found');
    await monthEndService.assertCycleIsOpen(homeId, expense.cycle);
    if (expense.status === ExpenseStatus.Paid) {
      throw ApiError.conflict('This expense is paid. Reverse its payment before deleting it.');
    }

    await expense.deleteOne();
    return { message: 'Expense deleted' };
  },
};
