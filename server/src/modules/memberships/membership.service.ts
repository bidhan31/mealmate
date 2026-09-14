import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { MembershipStatus, NotificationType, Role } from '../../config/enums';
import { User } from '../users/user.model';
import { IMemberDisabledSlot, Membership } from './membership.model';
import { notificationService } from '../notifications/notification.service';

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  avatar?: string;
  phone?: string;
}

function shapeMembership(m: {
  _id: Types.ObjectId;
  role: Role;
  status: MembershipStatus;
  roomId?: Types.ObjectId | null;
  userId: PopulatedUser | Types.ObjectId;
  joinedAt?: Date | null;
  disabledSlots?: IMemberDisabledSlot[];
}) {
  const user = m.userId as PopulatedUser;
  return {
    id: m._id.toString(),
    role: m.role,
    status: m.status,
    roomId: m.roomId ? m.roomId.toString() : null,
    joinedAt: m.joinedAt ?? null,
    disabledSlots: (m.disabledSlots ?? []).map((d) => ({
      _id: (d as { _id?: Types.ObjectId })._id?.toString(),
      slot: d.slot,
      from: d.from,
      to: d.to,
    })),
    user:
      user && 'name' in user
        ? {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar ?? null,
            phone: user.phone ?? null,
          }
        : null,
  };
}

export const membershipService = {
  async listMembers(homeId: Types.ObjectId, status?: MembershipStatus) {
    const filter: Record<string, unknown> = { homeId };
    if (status) filter.status = status;
    else filter.status = { $ne: MembershipStatus.Removed };

    const members = await Membership.find(filter).populate('userId', 'name email avatar phone').lean();
    return { members: members.map((m) => shapeMembership(m as never)) };
  },

  async approve(homeId: Types.ObjectId, membershipId: string) {
    const membership = await Membership.findOne({
      _id: new Types.ObjectId(membershipId),
      homeId,
    });
    if (!membership) throw ApiError.notFound('Membership not found');
    if (membership.status !== MembershipStatus.Pending) {
      throw ApiError.badRequest('Only pending requests can be approved');
    }
    membership.status = MembershipStatus.Active;
    membership.joinedAt = new Date();
    await membership.save();
    await User.updateOne({ _id: membership.userId }, { activeMembershipId: membership._id });

    // Clean up any other invites or pending requests for this user across all homes
    await Membership.deleteMany({
      userId: membership.userId,
      status: { $in: [MembershipStatus.Invited, MembershipStatus.Pending] },
      _id: { $ne: membership._id },
    });

    // Notify the approved member — non-blocking
    notificationService
      .create({
        userId: membership.userId as Types.ObjectId,
        homeId: membership.homeId as Types.ObjectId,
        type: NotificationType.JoinRequestApproved,
        message: 'Your request to join the home has been approved! Welcome.',
        meta: { membershipId: membership._id.toString() },
      })
      .catch(() => {/* swallow */});

    // Broadcast to home members that a new member joined
    Membership.find({ homeId: membership.homeId, status: MembershipStatus.Active, userId: { $ne: membership.userId } })
      .distinct('userId')
      .then((memberUserIds) => {
        notificationService.createForHomeMembers(
          memberUserIds as Types.ObjectId[],
          membership.homeId as Types.ObjectId,
          NotificationType.MemberJoined,
          'A new member has joined your Home!',
          { membershipId: membership._id.toString() },
        ).catch(() => {});
      })
      .catch(() => {});

    return { message: 'Member approved' };
  },

  async reject(homeId: Types.ObjectId, membershipId: string) {
    const membership = await Membership.findOne({
      _id: new Types.ObjectId(membershipId),
      homeId,
    });
    if (!membership) throw ApiError.notFound('Membership not found');
    if (membership.status !== MembershipStatus.Pending) {
      throw ApiError.badRequest('Only pending requests can be rejected');
    }
    const targetUserId = membership.userId;
    await Membership.deleteOne({ _id: membership._id });

    notificationService
      .create({
        userId: targetUserId as Types.ObjectId,
        homeId,
        type: NotificationType.JoinRequestRejected,
        message: 'Your request to join the home was rejected.',
      })
      .catch(() => {});

    return { message: 'Join request rejected' };
  },

  async remove(homeId: Types.ObjectId, membershipId: string, actingUserId: string) {
    const membership = await Membership.findOne({
      _id: new Types.ObjectId(membershipId),
      homeId,
    });
    if (!membership) throw ApiError.notFound('Membership not found');
    if (membership.role === Role.Admin) throw ApiError.badRequest('Cannot remove the home admin');
    if (membership.userId.toString() === actingUserId) {
      throw ApiError.badRequest('Use leave-home to remove yourself');
    }
    membership.status = MembershipStatus.Removed;
    membership.roomId = null;
    await membership.save();
    
    // Only nullify if this membership was their active one
    await User.updateOne(
      { _id: membership.userId, activeMembershipId: membership._id },
      { activeMembershipId: null }
    );

    notificationService
      .create({
        userId: membership.userId as Types.ObjectId,
        homeId,
        type: NotificationType.MemberRemoved,
        message: 'You have been removed from the Home by the Admin.',
      })
      .catch(() => {});

    return { message: 'Member removed' };
  },

  async updateRole(homeId: Types.ObjectId, membershipId: string, role: Role, actingUserId: string) {
    const membership = await Membership.findOne({
      _id: new Types.ObjectId(membershipId),
      homeId,
    });
    if (!membership) throw ApiError.notFound('Membership not found');
    
    if (membership.userId.toString() === actingUserId && role === Role.Member) {
      // Trying to demote self. Must check if there is another admin.
      const otherAdminsCount = await Membership.countDocuments({
        homeId,
        role: Role.Admin,
        status: MembershipStatus.Active,
        _id: { $ne: membership._id }
      });
      if (otherAdminsCount === 0) {
        throw ApiError.badRequest('Cannot demote yourself. You are the only admin.');
      }
    }

    membership.role = role;
    await membership.save();

    notificationService
      .create({
        userId: membership.userId as Types.ObjectId,
        homeId,
        type: NotificationType.AdminRoleTransferred,
        message: `Your role in the home has been updated to ${role.toUpperCase()}.`,
      })
      .catch(() => {});

    return { message: 'Role updated' };
  },

  async invite(homeId: Types.ObjectId, email: string) {
    const user = await User.findOne({ email });
    if (!user) throw ApiError.notFound('User with this email not found');

    // Prevent inviting users who are already active or pending in *any* home
    const activeOrPendingElsewhere = await Membership.findOne({
      userId: user._id,
      status: { $in: [MembershipStatus.Active, MembershipStatus.Pending] },
    });
    if (activeOrPendingElsewhere) {
      if (activeOrPendingElsewhere.homeId.toString() === homeId.toString()) {
        throw ApiError.badRequest('User is already a member or has a pending request for this home');
      } else {
        throw ApiError.badRequest('User is already in another home or has a pending request elsewhere');
      }
    }

    let membership = await Membership.findOne({ homeId, userId: user._id });
    if (membership) {
      if (membership.status === MembershipStatus.Invited) throw ApiError.badRequest('User is already invited');
      
      // If removed, transition them back to invited
      if (membership.status === MembershipStatus.Removed) {
        membership.status = MembershipStatus.Invited;
        membership.role = Role.Member;
        await membership.save();

        notificationService
          .create({
            userId: user._id as Types.ObjectId,
            homeId,
            type: NotificationType.InvitationReceived,
            message: 'You have received an invitation to join a Home!',
          })
          .catch(() => {});

        return { message: 'Invitation sent' };
      }
    }

    await Membership.create({
      homeId,
      userId: user._id,
      role: Role.Member,
      status: MembershipStatus.Invited,
    });

    notificationService
      .create({
        userId: user._id as Types.ObjectId,
        homeId,
        type: NotificationType.InvitationReceived,
        message: 'You have received an invitation to join a Home!',
      })
      .catch(() => {});

    return { message: 'Invitation sent' };
  },
};
