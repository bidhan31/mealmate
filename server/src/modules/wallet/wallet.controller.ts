import { Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { HomeScopedRequest } from '../../middleware/rbac';
import { ApiError } from '../../utils/ApiError';
import { Role } from '../../config/enums';
import { Wallet } from './wallet.model';
import { walletService } from './wallet.service';

export const walletController = {
  /** List every member's wallet balance in the home (admin) or just the caller's (member). */
  list: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    if (req.membership!.role === Role.Admin) {
      const wallets = await Wallet.find({ homeId })
        .populate<{ membershipId: { _id: Types.ObjectId; userId: Types.ObjectId } }>({
          path: 'membershipId',
          select: 'userId',
          populate: { path: 'userId', select: 'name' },
        })
        .lean();
      return sendSuccess(res, { wallets }, 'Wallets');
    }
    const wallet = await walletService.getOrCreate(homeId, req.membership!._id);
    return sendSuccess(res, { wallets: [wallet] }, 'Wallet');
  }),

  /** Ledger for a member. Members may only view their own. */
  transactions: asyncHandler(async (req: HomeScopedRequest, res: Response) => {
    const homeId = req.membership!.homeId;
    const target = req.params.membershipId;
    if (
      req.membership!.role !== Role.Admin &&
      target !== req.membership!._id.toString()
    ) {
      throw ApiError.forbidden('You can only view your own wallet ledger');
    }
    const result = await walletService.transactions(homeId, new Types.ObjectId(target));
    sendSuccess(res, result, 'Wallet transactions');
  }),
};
