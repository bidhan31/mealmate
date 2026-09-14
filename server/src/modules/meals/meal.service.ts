import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { GuestMealStatus, MealSlot, MealType, MembershipStatus, NotificationType } from '../../config/enums';
import { cycleFromDateKey, isValidDateKey, todayKey } from '../../utils/dates';
import { Home, IHome } from '../homes/home.model';
import { IMealSlots, Meal } from './meal.model';
import { IMembership, Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { AuditLog } from '../auditLog/auditLog.model';

const SLOTS: MealSlot[] = [MealSlot.Breakfast, MealSlot.Lunch, MealSlot.Dinner];
const DEFAULT_SLOTS: IMealSlots = { breakfast: false, lunch: false, dinner: false };

async function getHomeOrThrow(homeId: Types.ObjectId): Promise<IHome> {
  const home = await Home.findById(homeId);
  if (!home) throw ApiError.notFound('Home not found');
  return home;
}

async function activeMemberCount(homeId: Types.ObjectId): Promise<number> {
  return Membership.countDocuments({ homeId, status: MembershipStatus.Active });
}

/**
 * Whether a slot is turned off HOME-WIDE for a date (admin shutoff window or a
 * permanently-off mealSetting). Home-off slots can never count for anyone.
 */
function slotDisabledByHome(home: IHome, date: string, slot: MealSlot): boolean {
  const ms = home.mealSettings;
  if (slot === MealSlot.Breakfast && !ms.breakfast) return true;
  if (slot === MealSlot.Lunch && !ms.lunch) return true;
  if (slot === MealSlot.Dinner && !ms.dinner) return true;
  for (const d of home.disabledSlots ?? []) {
    if (d.slot === slot && date >= d.from && date <= d.to) return true;
  }
  return false;
}

/** Whether a MEMBER has turned off a slot themselves for a date. */
function slotDisabledByMember(membership: IMembership, date: string, slot: MealSlot): boolean {
  for (const d of membership.disabledSlots ?? []) {
    if (d.slot === slot && date >= d.from && date <= d.to) return true;
  }
  return false;
}

/**
 * A slot is LOCKED for a member on a date when either the home turned it off or
 * the member turned it off themselves. A locked slot cannot count and cannot be
 * selected by anyone (incl. admin) until the relevant window is removed.
 */
function slotLockedForMember(home: IHome, membership: IMembership, date: string, slot: MealSlot): boolean {
  return slotDisabledByHome(home, date, slot) || slotDisabledByMember(membership, date, slot);
}

/** Slots the home has turned off for a date (admin windows + permanent settings). */
function homeDisabledSlotsForDate(home: IHome, date: string): MealSlot[] {
  return SLOTS.filter((s) => slotDisabledByHome(home, date, s));
}

/** Slots locked for a specific member on a date (home OR self). */
function lockedSlotsForMember(home: IHome, membership: IMembership, date: string): MealSlot[] {
  return SLOTS.filter((s) => slotLockedForMember(home, membership, date, s));
}

/**
 * Effective meal count = number of slots the member selected (ON) that are NOT
 * locked (neither home-off nor self-off) for that date. Stored on `count` so all
 * downstream aggregations ($sum: '$count') stay exact.
 */
function computeEffectiveCount(
  slots: IMealSlots,
  home: IHome,
  membership: IMembership,
  date: string,
): number {
  let c = 0;
  for (const s of SLOTS) {
    if (slots[s as keyof IMealSlots] && !slotLockedForMember(home, membership, date, s)) c += 1;
  }
  return c;
}

/**
 * Recompute and persist the effective `count` for NORMAL meal records in a home
 * within [from, to]. Optionally scoped to one member. Called after any slot
 * change so stored counts never drift from slot state — keeping money accurate.
 */
async function recomputeRange(
  home: IHome,
  from: string,
  to: string,
  membershipId?: Types.ObjectId,
): Promise<void> {
  const filter: Record<string, unknown> = {
    homeId: home._id,
    type: MealType.Normal,
    date: { $gte: from, $lte: to },
  };
  if (membershipId) filter.membershipId = membershipId;

  const meals = await Meal.find(filter);
  if (!meals.length) return;

  // Defense-in-depth: build a set of open cycles within the range so we never
  // rewrite stored counts for meals that belong to a closed month — even if
  // a caller forgets to check upfront.
  const uniqueCycles = [...new Set(meals.map((m) => m.cycle))];
  const openCycles = new Set<string>();
  for (const cycle of uniqueCycles) {
    const isOpen = await monthEndService.isCycleOpen(home._id, cycle);
    if (isOpen) openCycles.add(cycle);
  }

  // Load the memberships referenced so self-disable windows are respected.
  const memberIds = [...new Set(meals.map((m) => m.membershipId.toString()))];
  const memberships = await Membership.find({ _id: { $in: memberIds } });
  const memberMap = new Map(memberships.map((m) => [m._id.toString(), m]));

  const ops = [];
  for (const meal of meals) {
    // Skip meals belonging to a closed cycle — immutable
    if (!openCycles.has(meal.cycle)) continue;
    const membership = memberMap.get(meal.membershipId.toString());
    if (!membership) continue;
    const slots = (meal.slots ?? DEFAULT_SLOTS) as IMealSlots;
    const next = computeEffectiveCount(slots, home, membership, meal.date);
    if (next !== meal.count) {
      ops.push({
        updateOne: { filter: { _id: meal._id }, update: { $set: { count: next } } },
      });
    }
  }
  if (ops.length) await Meal.bulkWrite(ops);
}


export const mealService = {
  /**
   * Set slot state (breakfast/lunch/dinner on/off) for a member on a single day.
   * Only slots present in `slotUpdates` change; the rest are preserved. Locked
   * slots (home-off or the member's own self-off) cannot be modified by anyone.
   */
  async setSlots(
    homeId: Types.ObjectId,
    membershipId: Types.ObjectId,
    date: string,
    slotUpdates: Partial<IMealSlots>,
  ) {
    if (!isValidDateKey(date)) throw ApiError.badRequest('Invalid date');
    const cycle = cycleFromDateKey(date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    const home = await getHomeOrThrow(homeId);
    const membership = await Membership.findOne({ _id: membershipId, homeId });
    if (!membership) throw ApiError.notFound('Membership not found');

    const today = todayKey(home.timezone);
    if (date < today) throw ApiError.badRequest('Cannot change meals for a past day');
    if (home.closedMealDates?.includes(date)) {
      throw ApiError.badRequest(`Meals for ${date} are locked by admin`);
    }

    // Guard: a locked slot (home-off or member self-off) cannot be changed.
    for (const key of Object.keys(slotUpdates) as (keyof IMealSlots)[]) {
      const slot = key as unknown as MealSlot;
      if (slotDisabledByHome(home, date, slot)) {
        throw ApiError.badRequest(`${key} is turned off by admin for ${date} and cannot be changed`);
      }
      if (slotDisabledByMember(membership, date, slot)) {
        throw ApiError.badRequest(`You turned off ${key} for ${date}; re-enable it first`);
      }
    }

    const existing = await Meal.findOne({ homeId, membershipId, date, type: MealType.Normal });
    const current = (existing?.slots ?? DEFAULT_SLOTS) as IMealSlots;
    const nextSlots: IMealSlots = {
      breakfast: current.breakfast,
      lunch: current.lunch,
      dinner: current.dinner,
      ...slotUpdates,
    };
    const count = computeEffectiveCount(nextSlots, home, membership, date);

    const meal = await Meal.findOneAndUpdate(
      { homeId, membershipId, date, type: MealType.Normal },
      { $set: { slots: nextSlots, count, cycle }, $setOnInsert: { createdBy: membershipId } },
      { upsert: true, new: true },
    );
    return {
      meal: { id: meal._id.toString(), date, count: meal.count, slots: meal.slots, type: meal.type },
    };
  },

  /**
   * Member self turn-off: LOCK selected slots across an inclusive date range by
   * recording windows on the membership, then zero those slots' counts for the
   * range. Locked slots cannot be counted or re-selected until removed.
   */
  async disableMemberSlots(
    homeId: Types.ObjectId,
    membershipId: Types.ObjectId,
    slots: MealSlot[],
    from: string,
    to: string,
  ) {
    if (!isValidDateKey(from) || !isValidDateKey(to)) throw ApiError.badRequest('Invalid date');
    if (from > to) throw ApiError.badRequest('Range start must be on or before end');

    const home = await getHomeOrThrow(homeId);
    const membership = await Membership.findOne({ _id: membershipId, homeId });
    if (!membership) throw ApiError.notFound('Membership not found');

    const today = todayKey(home.timezone);
    const start = from < today ? today : from; // never touch past days
    if (start > to) throw ApiError.badRequest('Cannot disable meals for a past range');

    // Guard: reject if the effective range touches any closed cycle
    const fromCycle = cycleFromDateKey(start);
    const toCycle = cycleFromDateKey(to);
    await monthEndService.assertCycleIsOpen(homeId, fromCycle);
    if (toCycle !== fromCycle) await monthEndService.assertCycleIsOpen(homeId, toCycle);

    // Record the self turn-off windows (locks) on the membership.
    membership.disabledSlots = membership.disabledSlots ?? [];
    for (const slot of slots) {
      membership.disabledSlots.push({ slot, from: start, to });
    }
    await membership.save();

    // Zero those slots for the range so counts reflect the lock immediately.
    await recomputeRange(home, start, to, membershipId);

    return {
      message: `Turned off ${slots.join(', ')} for ${start} → ${to}`,
      disabledSlots: membership.disabledSlots,
    };
  },

  /** Member: remove one of their own turn-off windows (re-enable) and recompute. */
  async removeMemberSlotWindow(
    homeId: Types.ObjectId,
    membershipId: Types.ObjectId,
    windowId: string,
  ) {
    const membership = await Membership.findOne({ _id: membershipId, homeId });
    if (!membership) throw ApiError.notFound('Membership not found');
    const list = membership.disabledSlots ?? [];
    const target = list.find((d) => d._id?.toString() === windowId);
    if (!target) throw ApiError.notFound('Turn-off window not found');

    // Guard: reject if the window's range touches any closed cycle
    const fromCycle = cycleFromDateKey(target.from);
    const toCycle = cycleFromDateKey(target.to);
    await monthEndService.assertCycleIsOpen(homeId, fromCycle);
    if (toCycle !== fromCycle) await monthEndService.assertCycleIsOpen(homeId, toCycle);

    membership.disabledSlots = list.filter((d) => d._id?.toString() !== windowId);
    await membership.save();

    const home = await getHomeOrThrow(homeId);
    await recomputeRange(home, target.from, target.to, membershipId);
    return { message: 'Meal re-enabled', disabledSlots: membership.disabledSlots };
  },

  /**
   * Admin: turn OFF one or more slots home-wide for an inclusive date range.
   * Stored on the Home and applied to every member's effective count.
   */
  async disableHomeSlots(
    homeId: Types.ObjectId,
    adminId: Types.ObjectId,
    slots: MealSlot[],
    from: string,
    to: string,
  ) {
    if (!isValidDateKey(from) || !isValidDateKey(to)) throw ApiError.badRequest('Invalid date');
    if (from > to) throw ApiError.badRequest('Range start must be on or before end');

    const home = await getHomeOrThrow(homeId);
    const today = todayKey(home.timezone);
    const start = from < today ? today : from;
    if (start > to) throw ApiError.badRequest('Cannot disable meals for a past range');

    // Guard: reject if the effective range touches any closed cycle
    const fromCycle = cycleFromDateKey(start);
    const toCycle = cycleFromDateKey(to);
    await monthEndService.assertCycleIsOpen(homeId, fromCycle);
    if (toCycle !== fromCycle) await monthEndService.assertCycleIsOpen(homeId, toCycle);

    home.disabledSlots = home.disabledSlots ?? [];
    for (const slot of slots) {
      home.disabledSlots.push({ slot, from: start, to });
    }
    await home.save();

    // Reflect the change in stored effective counts.
    await recomputeRange(home, start, to);

    const admin = await Membership.findById(adminId).populate('userId');
    const adminName = (admin?.userId as { name?: string } | undefined)?.name ?? 'Admin';
    const actorUserId = (admin?.userId as { _id?: Types.ObjectId } | undefined)?._id ?? adminId;
    await AuditLog.create({
      homeId,
      actorUserId,
      actorName: adminName,
      action: 'Disabled Meal Slots (home)',
      targetModel: 'Home',
      targetId: homeId.toString(),
      before: null,
      after: { slots, from: start, to },
    });

    return { message: `Turned off ${slots.join(', ')} for the home`, disabledSlots: home.disabledSlots };
  },

  /** Admin: remove a home-wide disable window (re-enable) and recompute counts. */
  async removeHomeSlotWindow(homeId: Types.ObjectId, windowId: string) {
    const home = await getHomeOrThrow(homeId);
    const list = home.disabledSlots ?? [];
    const target = list.find((d) => (d as unknown as { _id: Types.ObjectId })._id?.toString() === windowId);
    if (!target) throw ApiError.notFound('Disable window not found');

    // Guard: reject if the window's range touches any closed cycle
    const fromCycle = cycleFromDateKey(target.from);
    const toCycle = cycleFromDateKey(target.to);
    await monthEndService.assertCycleIsOpen(homeId, fromCycle);
    if (toCycle !== fromCycle) await monthEndService.assertCycleIsOpen(homeId, toCycle);

    home.disabledSlots = list.filter(
      (d) => (d as unknown as { _id: Types.ObjectId })._id?.toString() !== windowId,
    );
    await home.save();

    await recomputeRange(home, target.from, target.to);
    return { message: 'Meal slot re-enabled', disabledSlots: home.disabledSlots };
  },

  /** All meals in the home for a given day (normal + approved/pending guest). */
  async listByDate(homeId: Types.ObjectId, date: string) {
    if (!isValidDateKey(date)) throw ApiError.badRequest('Invalid date');
    const home = await getHomeOrThrow(homeId);
    const meals = await Meal.find({ homeId, date }).populate('membershipId', 'userId').lean();

    // Include every ACTIVE member so the UI can render each member's slot state
    // on load — even before a meal record exists for the day.
    const memberships = await Membership.find({
      homeId,
      status: MembershipStatus.Active,
    }).lean();
    const memberMap = new Map(memberships.map((m) => [m._id.toString(), m as unknown as IMembership]));

    const todayTotal = meals
      .filter((m) => m.type === MealType.Normal || m.guestStatus === GuestMealStatus.Approved)
      .reduce((sum, m) => sum + m.count, 0);

    // Guest rows pass through as-is.
    const guestRows = meals
      .filter((m) => m.type === MealType.Guest)
      .map((m) => ({
        id: m._id.toString(),
        membershipId: m.membershipId?._id?.toString() ?? m.membershipId?.toString(),
        type: m.type,
        count: m.count,
        slots: null,
        slot: m.slot ?? null,
        lockedSlots: [] as MealSlot[],
        guestStatus: m.guestStatus ?? null,
        note: m.note ?? null,
      }));

    // One normal row per active member: real record if present, else synthesized.
    const normalByMember = new Map<string, (typeof meals)[number]>();
    for (const m of meals) {
      if (m.type === MealType.Normal) {
        const mid = m.membershipId?._id?.toString() ?? m.membershipId?.toString();
        if (mid) normalByMember.set(mid, m);
      }
    }

    const normalRows = memberships.map((mb) => {
      const mid = mb._id.toString();
      const membership = memberMap.get(mid)!;
      const record = normalByMember.get(mid);
      const slots = (record?.slots ?? DEFAULT_SLOTS) as IMealSlots;
      return {
        id: record?._id.toString() ?? `virtual:${mid}:${date}`,
        membershipId: mid,
        type: MealType.Normal,
        count: record?.count ?? computeEffectiveCount(slots, home, membership, date),
        slots,
        slot: null,
        lockedSlots: lockedSlotsForMember(home, membership, date),
        guestStatus: null,
        note: record?.note ?? null,
      };
    });

    return {
      date,
      todayTotalMealCount: todayTotal,
      homeDisabledSlots: homeDisabledSlotsForDate(home, date),
      meals: [...normalRows, ...guestRows],
    };
  },

  /** Per-member and home-wide monthly meal counts for a cycle. */
  async monthlySummary(homeId: Types.ObjectId, cycle: string) {
    const rows = await Meal.aggregate<{ _id: Types.ObjectId; total: number }>([
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

    const byMember = rows.map((r) => ({
      membershipId: r._id.toString(),
      totalMeals: r.total,
    }));
    const homeTotal = byMember.reduce((s, r) => s + r.totalMeals, 0);
    return { cycle, homeTotalMealCount: homeTotal, byMember };
  },

  /** Daily breakdown of all meals in a cycle month */
  async monthlyCalendar(homeId: Types.ObjectId, cycle: string) {
    const meals = await Meal.find({
      homeId,
      cycle,
      $or: [
        { type: MealType.Normal },
        { type: MealType.Guest, guestStatus: GuestMealStatus.Approved },
      ],
    })
      .populate('membershipId', 'userId')
      .lean();

    return {
      cycle,
      meals: meals.map((m) => ({
        id: m._id.toString(),
        membershipId: m.membershipId?._id?.toString() ?? m.membershipId?.toString(),
        date: m.date,
        type: m.type,
        count: m.count,
        slots: m.type === MealType.Normal ? (m.slots ?? DEFAULT_SLOTS) : null,
        slot: m.slot ?? null,
        guestStatus: m.guestStatus ?? null,
        note: m.note ?? null,
      })),
    };
  },

  /** Create a guest-meal request (pending approval). */
  async requestGuestMeal(
    homeId: Types.ObjectId,
    hostMembershipId: Types.ObjectId,
    date: string,
    slot: MealSlot,
    count: number,
    note?: string,
  ) {
    if (!isValidDateKey(date)) throw ApiError.badRequest('Invalid date');
    const cycle = cycleFromDateKey(date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    const home = await getHomeOrThrow(homeId);
    if (home.closedMealDates?.includes(date)) {
      throw ApiError.badRequest(`Meals for ${date} are locked by admin`);
    }
    const meal = await Meal.create({
      homeId,
      membershipId: hostMembershipId, // count attaches to host
      requestedByMembershipId: hostMembershipId,
      date,
      cycle,
      type: MealType.Guest,
      slot,
      count,
      guestStatus: GuestMealStatus.Pending,
      note,
      createdBy: hostMembershipId,
    });

    Membership.find({ homeId, status: MembershipStatus.Active, _id: { $ne: hostMembershipId } })
      .distinct('userId')
      .then((memberUserIds) => {
        notificationService.createForHomeMembers(
          memberUserIds as Types.ObjectId[],
          homeId,
          NotificationType.GuestMealRequested,
          `A guest meal request (${count} meal/s for ${slot}) was submitted for ${date}.`,
          { mealId: meal._id.toString(), date, slot, count },
        ).catch(() => {});
      })
      .catch(() => {});

    return { meal: { id: meal._id.toString(), status: meal.guestStatus } };
  },

  async listGuestRequests(homeId: Types.ObjectId, status?: GuestMealStatus) {
    const filter: Record<string, unknown> = { homeId, type: MealType.Guest };
    if (status) filter.guestStatus = status;
    const meals = await Meal.find(filter).populate('membershipId', 'userId').lean();
    return {
      requests: meals.map((m) => ({
        id: m._id.toString(),
        membershipId: m.membershipId?._id?.toString() ?? m.membershipId?.toString(),
        date: m.date,
        slot: m.slot ?? null,
        count: m.count,
        status: m.guestStatus,
        note: m.note ?? null,
      })),
    };
  },

  async resolveGuestMeal(homeId: Types.ObjectId, mealId: string, approve: boolean) {
    const meal = await Meal.findOne({
      _id: new Types.ObjectId(mealId),
      homeId,
      type: MealType.Guest,
    });
    if (!meal) throw ApiError.notFound('Guest meal request not found');
    if (meal.guestStatus !== GuestMealStatus.Pending) {
      throw ApiError.badRequest('Request already resolved');
    }
    await monthEndService.assertCycleIsOpen(homeId, meal.cycle);

    meal.guestStatus = approve ? GuestMealStatus.Approved : GuestMealStatus.Rejected;
    await meal.save();

    // Notify the requester — non-blocking
    Membership.findById(meal.membershipId)
      .select('userId homeId')
      .lean()
      .then((m) => {
        if (!m) return;
        return notificationService.create({
          userId: m.userId as Types.ObjectId,
          homeId: m.homeId as Types.ObjectId,
          type: NotificationType.GuestMealResolved,
          message: approve
            ? `Your guest meal request for ${meal.date} was approved.`
            : `Your guest meal request for ${meal.date} was rejected.`,
          meta: { mealId, date: meal.date, approved: approve },
        });
      })
      .catch(() => {/* swallow */});

    return { message: approve ? 'Guest meal approved' : 'Guest meal rejected' };
  },

  /** Close meals for a specific date (Admin only) */
  async closeDay(homeId: Types.ObjectId, date: string, adminId: Types.ObjectId) {
    if (!isValidDateKey(date)) throw ApiError.badRequest('Invalid date');

    // Guard: cannot close a day in a closed cycle
    const cycle = cycleFromDateKey(date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    const home = await getHomeOrThrow(homeId);
    if (home.closedMealDates?.includes(date)) {
      throw ApiError.badRequest('This date is already closed');
    }

    // Check for pending guest meals
    const pendingGuests = await Meal.countDocuments({
      homeId,
      date,
      type: MealType.Guest,
      guestStatus: GuestMealStatus.Pending,
    });

    if (pendingGuests > 0) {
      throw ApiError.badRequest(`PendingGuestMeals:${pendingGuests}`);
    }

    home.closedMealDates = home.closedMealDates || [];
    home.closedMealDates.push(date);
    await home.save();

    // Create Audit Log
    const admin = await Membership.findById(adminId).populate('userId');
    const adminName = (admin?.userId as { name?: string } | undefined)?.name ?? 'Admin';
    const actorUserId = (admin?.userId as { _id?: Types.ObjectId } | undefined)?._id ?? adminId;

    await AuditLog.create({
      homeId,
      actorUserId,
      actorName: adminName,
      action: 'Closed Meal Count',
      targetModel: 'Meal',
      targetId: date,
      before: null,
      after: { closed: true },
    });

    return { message: `Meals for ${date} are now closed` };
  },

  /**
   * Cron helper: ensure a normal meal row exists for every active member for the
   * given day (idempotent). For each member the initializer first checks whether
   * a slot is turned off (admin home-wide OR that member's own turn-off window)
   * for the date: turned-off slots are recorded as locked/off, the rest start
   * deselected. Either way the initial effective count is 0 — members opt in per
   * meal type afterwards.
   */
  async ensureDailyMeals(homeId: Types.ObjectId, date: string): Promise<number> {
    const cycle = cycleFromDateKey(date);
    // Guard: skip silently if cycle is already closed (cron should not create records in closed cycles)
    const isOpen = await monthEndService.isCycleOpen(homeId, cycle);
    if (!isOpen) return 0;
    const home = await getHomeOrThrow(homeId);
    const members = await Membership.find({ homeId, status: MembershipStatus.Active });
    let created = 0;
    for (const m of members) {
      // Effective count for a brand-new, all-deselected row respecting any
      // turn-off condition (home or self) for this member on this date.
      const count = computeEffectiveCount(DEFAULT_SLOTS, home, m, date);
      const res = await Meal.updateOne(
        { homeId, membershipId: m._id, date, type: MealType.Normal },
        { $setOnInsert: { count, slots: DEFAULT_SLOTS, cycle, createdBy: m._id } },
        { upsert: true },
      );
      if (res.upsertedCount) created += 1;
    }
    return created;
  },

  async getHomeTimezone(homeId: Types.ObjectId): Promise<string> {
    const home = await getHomeOrThrow(homeId);
    return home.timezone;
  },

  async todayForHome(homeId: Types.ObjectId): Promise<string> {
    const tz = await this.getHomeTimezone(homeId);
    return todayKey(tz);
  },

  activeMemberCount,
};
