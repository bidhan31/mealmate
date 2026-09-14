import { Types } from 'mongoose';
import { Essential, IEssential } from './essential.model';

export const essentialService = {
  async list(homeId: string) {
    const items = await Essential.find({ homeId: new Types.ObjectId(homeId) })
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    return items;
  },

  async create(homeId: string, userId: string, payload: Partial<IEssential>) {
    const item = await Essential.create({
      ...payload,
      homeId: new Types.ObjectId(homeId),
      createdBy: new Types.ObjectId(userId),
    });
    return item;
  },

  async update(homeId: string, itemId: string, payload: Partial<IEssential>) {
    const item = await Essential.findOneAndUpdate(
      { _id: new Types.ObjectId(itemId), homeId: new Types.ObjectId(homeId) },
      { $set: payload },
      { new: true },
    ).lean();
    return item;
  },

  async delete(homeId: string, itemId: string) {
    const res = await Essential.deleteOne({
      _id: new Types.ObjectId(itemId),
      homeId: new Types.ObjectId(homeId),
    });
    return res.deletedCount > 0;
  },
};
