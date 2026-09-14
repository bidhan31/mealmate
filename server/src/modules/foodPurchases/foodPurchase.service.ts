import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { cycleFromDateKey, isValidDateKey } from '../../utils/dates';
import { FoodPurchase, IFoodPurchaseItem } from './foodPurchase.model';
import { monthEndService } from '../monthEnd/monthEnd.service';
import { FoodPurchaseStatus, MembershipStatus, NotificationType } from '../../config/enums';
import { Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';

function computeTotal(items: IFoodPurchaseItem[]): number {
  return items.reduce((sum, i) => sum + i.qty * i.price, 0);
}

export const foodPurchaseService = {
  async create(
    homeId: Types.ObjectId,
    membershipId: Types.ObjectId,
    data: { items: IFoodPurchaseItem[]; date: string; note?: string },
    isAdmin: boolean = false,
  ) {
    if (!isValidDateKey(data.date)) throw ApiError.badRequest('Invalid date');
    const cycle = cycleFromDateKey(data.date);
    await monthEndService.assertCycleIsOpen(homeId, cycle);

    const totalAmount = computeTotal(data.items);
    const status = isAdmin ? FoodPurchaseStatus.Approved : FoodPurchaseStatus.Pending;

    const purchase = await FoodPurchase.create({
      homeId,
      membershipId,
      items: data.items,
      totalAmount,
      date: data.date,
      cycle,
      note: data.note,
      status,
      reviewedBy: isAdmin ? membershipId : null,
      reviewedAt: isAdmin ? new Date() : null,
    });

    Membership.find({ homeId, status: MembershipStatus.Active })
      .distinct('userId')
      .then((memberUserIds) => {
        notificationService.createForHomeMembers(
          memberUserIds as Types.ObjectId[],
          homeId,
          NotificationType.NewFoodPurchase,
          `A new food purchase of BDT ${totalAmount} was logged.`,
          { purchaseId: purchase._id.toString() },
        ).catch(() => {});
      })
      .catch(() => {});

    return { purchase };
  },

  async review(
    homeId: Types.ObjectId,
    adminMembershipId: Types.ObjectId,
    id: string,
    status: FoodPurchaseStatus.Approved | FoodPurchaseStatus.Rejected,
  ) {
    const purchase = await FoodPurchase.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!purchase) throw ApiError.notFound('Food purchase request not found');
    await monthEndService.assertCycleIsOpen(homeId, purchase.cycle);

    purchase.status = status;
    purchase.reviewedBy = adminMembershipId;
    purchase.reviewedAt = new Date();
    await purchase.save();

    Membership.findById(purchase.membershipId)
      .then((m) => {
        if (m) {
          notificationService.create({
            userId: m.userId as Types.ObjectId,
            homeId,
            type: NotificationType.FoodPurchaseStatusChanged,
            message: `Your food purchase of BDT ${purchase.totalAmount} was ${status.toUpperCase()}.`,
            meta: { purchaseId: purchase._id.toString() },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return { purchase };
  },

  async list(homeId: Types.ObjectId, cycle?: string, status?: string) {
    const filter: Record<string, unknown> = { homeId };
    if (cycle) filter.cycle = cycle;
    if (status) filter.status = status;

    const purchases = await FoodPurchase.find(filter)
      .populate({
        path: 'membershipId',
        select: 'userId',
        populate: { path: 'userId', select: 'name email' },
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Approved total counts toward home food purchases
    const approvedPurchases = purchases.filter((p) => p.status === FoodPurchaseStatus.Approved);
    const total = approvedPurchases.reduce((s, p) => s + p.totalAmount, 0);

    const pendingCount = await FoodPurchase.countDocuments({
      homeId,
      ...(cycle ? { cycle } : {}),
      status: FoodPurchaseStatus.Pending,
    });

    return { total, pendingCount, purchases };
  },

  async remove(homeId: Types.ObjectId, id: string) {
    const purchase = await FoodPurchase.findOne({ _id: new Types.ObjectId(id), homeId });
    if (!purchase) throw ApiError.notFound('Purchase not found');
    await monthEndService.assertCycleIsOpen(homeId, purchase.cycle);

    await purchase.deleteOne();
    return { message: 'Purchase deleted' };
  },
};
