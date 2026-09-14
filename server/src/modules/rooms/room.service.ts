import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { MembershipStatus, NotificationType } from '../../config/enums';
import { Membership } from '../memberships/membership.model';
import { Room } from './room.model';
import { notificationService } from '../notifications/notification.service';

function publicRoom(
  room: { _id: Types.ObjectId; name: string; totalRent: number },
  memberCount: number,
) {
  return {
    id: room._id.toString(),
    name: room.name,
    totalRent: room.totalRent,
    memberCount,
    rentPerMember: memberCount > 0 ? Math.round((room.totalRent / memberCount) * 100) / 100 : 0,
  };
}

export const roomService = {
  async list(homeId: Types.ObjectId) {
    const rooms = await Room.find({ homeId }).lean();
    const counts = await Membership.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { homeId, status: MembershipStatus.Active, roomId: { $ne: null } } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));
    return {
      rooms: rooms.map((r) => publicRoom(r, countMap.get(r._id.toString()) ?? 0)),
    };
  },

  async create(homeId: Types.ObjectId, name: string, totalRent: number) {
    const exists = await Room.findOne({ homeId, name });
    if (exists) throw ApiError.conflict('A room with this name already exists');
    const room = await Room.create({ homeId, name, totalRent });
    return { room: publicRoom(room, 0) };
  },

  async update(homeId: Types.ObjectId, roomId: string, updates: { name?: string; totalRent?: number }) {
    const room = await Room.findOne({ _id: new Types.ObjectId(roomId), homeId });
    if (!room) throw ApiError.notFound('Room not found');
    const oldRent = room.totalRent;
    if (updates.name !== undefined) room.name = updates.name;
    if (updates.totalRent !== undefined) room.totalRent = updates.totalRent;
    await room.save();
    const count = await Membership.countDocuments({
      homeId,
      roomId: room._id,
      status: MembershipStatus.Active,
    });

    if (updates.totalRent !== undefined && updates.totalRent !== oldRent) {
      Membership.find({ homeId, roomId: room._id, status: MembershipStatus.Active })
        .distinct('userId')
        .then((memberUserIds) => {
          notificationService.createForHomeMembers(
            memberUserIds as Types.ObjectId[],
            homeId,
            NotificationType.RoomRentUpdated,
            `The total rent for room "${room.name}" was updated to BDT ${room.totalRent}.`,
          ).catch(() => {});
        })
        .catch(() => {});
    }

    return { room: publicRoom(room, count) };
  },

  async remove(homeId: Types.ObjectId, roomId: string) {
    const rid = new Types.ObjectId(roomId);
    const room = await Room.findOne({ _id: rid, homeId });
    if (!room) throw ApiError.notFound('Room not found');
    await Membership.updateMany({ homeId, roomId: rid }, { roomId: null });
    await Room.deleteOne({ _id: rid });
    return { message: 'Room deleted' };
  },

  async assignMember(homeId: Types.ObjectId, membershipId: string, roomId: string | null) {
    const membership = await Membership.findOne({
      _id: new Types.ObjectId(membershipId),
      homeId,
      status: MembershipStatus.Active,
    });
    if (!membership) throw ApiError.notFound('Active member not found');

    let roomName = '';
    if (roomId) {
      const room = await Room.findOne({ _id: new Types.ObjectId(roomId), homeId });
      if (!room) throw ApiError.notFound('Room not found');
      membership.roomId = room._id;
      roomName = room.name;
    } else {
      membership.roomId = null;
    }
    await membership.save();

    notificationService
      .create({
        userId: membership.userId as Types.ObjectId,
        homeId,
        type: NotificationType.RoomAssigned,
        message: roomId
          ? `You have been assigned to room "${roomName}".`
          : 'Your room assignment has been removed.',
      })
      .catch(() => {});

    return { message: 'Room assignment updated' };
  },
};
