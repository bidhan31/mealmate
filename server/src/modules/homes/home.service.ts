import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { MembershipStatus, NotificationType, Role } from '../../config/enums';
import { User } from '../users/user.model';
import { Home, IHome } from './home.model';
import { Membership } from '../memberships/membership.model';
import { notificationService } from '../notifications/notification.service';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
}

function publicHome(home: IHome) {
  return {
    id: home._id.toString(),
    name: home.name,
    adminUserId: home.adminUserId.toString(),
    mealSettings: home.mealSettings,
    currentCycle: home.currentCycle,
    timezone: home.timezone,
    descoAccountNo: home.descoAccountNo ?? '',
    inviteCode: home.inviteCode,
    expenseTypes: home.expenseTypes,
    closedMealDates: home.closedMealDates ?? [],
    disabledSlots: home.disabledSlots ?? [],
  };
}

async function assertNoActiveOrPendingMembership(userId: Types.ObjectId): Promise<void> {
  const existing = await Membership.findOne({
    userId,
    status: { $in: [MembershipStatus.Active, MembershipStatus.Pending] },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.status === MembershipStatus.Active
        ? 'You already belong to a home. Leave it before joining another.'
        : 'You already have a pending join request.',
    );
  }
}

export const homeService = {
  async createHome(userId: string, name: string, timezone?: string) {
    const uid = new Types.ObjectId(userId);
    await assertNoActiveOrPendingMembership(uid);

    const session = await mongoose.startSession();
    try {
      let created!: IHome;
      await session.withTransaction(async () => {
        const [home] = await Home.create(
          [
            {
              name,
              adminUserId: uid,
              inviteCode: generateInviteCode(),
              timezone: timezone || 'Asia/Dhaka',
            },
          ],
          { session },
        );

        const [membership] = await Membership.create(
          [
            {
              userId: uid,
              homeId: home._id,
              role: Role.Admin,
              status: MembershipStatus.Active,
              joinedAt: new Date(),
            },
          ],
          { session },
        );

        await User.updateOne({ _id: uid }, { activeMembershipId: membership._id }, { session });
        
        // Clean up any other invites or pending requests for this user across all homes
        await Membership.deleteMany({
          userId: uid,
          status: { $in: [MembershipStatus.Invited, MembershipStatus.Pending] },
        }, { session });

        created = home;
      });
      return { home: publicHome(created) };
    } finally {
      await session.endSession();
    }
  },

  async joinByInviteCode(userId: string, inviteCode: string) {
    const uid = new Types.ObjectId(userId);
    await assertNoActiveOrPendingMembership(uid);

    const home = await Home.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!home) throw ApiError.notFound('Invalid invite code');

    let membership = await Membership.findOne({ userId: uid, homeId: home._id });
    if (membership) {
      if (membership.status === MembershipStatus.Invited || membership.status === MembershipStatus.Removed) {
        membership.status = MembershipStatus.Pending;
        await membership.save();
      } else {
        throw ApiError.badRequest('You already have a membership record for this home');
      }
    } else {
      membership = await Membership.create({
        userId: uid,
        homeId: home._id,
        role: Role.Member,
        status: MembershipStatus.Pending,
      });
    }

    notificationService
      .create({
        userId: home.adminUserId,
        homeId: home._id,
        type: NotificationType.JoinRequestSubmitted,
        message: 'A user has requested to join your Home using the invite code.',
      })
      .catch(() => {});

    return {
      membership: {
        id: membership._id.toString(),
        homeId: home._id.toString(),
        status: membership.status,
      },
      home: { id: home._id.toString(), name: home.name },
    };
  },

  async getMyHome(userId: string) {
    const uid = new Types.ObjectId(userId);
    // Prefer an active record if legacy/corrupt data contains both states.
    const membership =
      (await Membership.findOne({ userId: uid, status: MembershipStatus.Active })) ??
      (await Membership.findOne({ userId: uid, status: MembershipStatus.Pending }));
    if (!membership) return { home: null, membership: null };

    const home = await Home.findById(membership.homeId);
    if (!home) return { home: null, membership: null };

    return {
      home: publicHome(home),
      membership: {
        id: membership._id.toString(),
        role: membership.role,
        status: membership.status,
        roomId: membership.roomId ? membership.roomId.toString() : null,
      },
    };
  },

  async cancelJoinRequest(userId: string) {
    const uid = new Types.ObjectId(userId);
    // Delete conditionally so an approval that wins a concurrent race is never
    // overwritten or reported as a successful cancellation.
    const request = await Membership.findOneAndDelete({ userId: uid, status: MembershipStatus.Pending });
    if (!request) throw ApiError.notFound('No pending join request found');

    // The target is derived from the authenticated user. This can never cancel
    // an active or invited membership, or another member's request.
    await User.updateOne(
      { _id: uid, activeMembershipId: request._id },
      { activeMembershipId: null },
    );
    return { message: 'Join request cancelled' };
  },

  async updateSettings(
    homeId: Types.ObjectId,
    updates: {
      name?: string;
      mealSettings?: Partial<IHome['mealSettings']>;
      timezone?: string;
      descoAccountNo?: string | null;
    },
  ) {
    const home = await Home.findById(homeId);
    if (!home) throw ApiError.notFound('Home not found');

    if (updates.name !== undefined) home.name = updates.name;
    if (updates.timezone !== undefined) home.timezone = updates.timezone;
    if (updates.descoAccountNo !== undefined) home.descoAccountNo = updates.descoAccountNo?.trim() || '';
    if (updates.mealSettings) {
      home.mealSettings = { ...home.mealSettings, ...updates.mealSettings };
    }
    await home.save();

    Membership.find({ homeId, status: MembershipStatus.Active })
      .distinct('userId')
      .then((memberUserIds) => {
        notificationService.createForHomeMembers(
          memberUserIds as Types.ObjectId[],
          homeId,
          NotificationType.HomeSettingsUpdated,
          'Home settings or active meal slots were updated by the Admin.',
        ).catch(() => {});
      })
      .catch(() => {});

    return { home: publicHome(home) };
  },

  async updateExpenseTypes(homeId: Types.ObjectId, expenseTypes: IHome['expenseTypes']) {
    const home = await Home.findById(homeId);
    if (!home) throw ApiError.notFound('Home not found');

    home.expenseTypes = expenseTypes;
    await home.save();
    return { home: publicHome(home) };
  },

  async leaveHome(userId: string, membershipId: Types.ObjectId, role: Role) {
    if (role === Role.Admin) {
      throw ApiError.badRequest('Admin cannot leave the home. Transfer ownership first.');
    }
    await Membership.updateOne({ _id: membershipId }, { status: MembershipStatus.Removed });
    await User.updateOne({ _id: new Types.ObjectId(userId) }, { activeMembershipId: null });
    return { message: 'You have left the home' };
  },

  async listInvitations(userId: string) {
    const invites = await Membership.find({
      userId: new Types.ObjectId(userId),
      status: MembershipStatus.Invited,
    }).populate<{ homeId: { _id: Types.ObjectId; name: string } }>('homeId', 'name').lean();

    return {
      invitations: invites.map((inv) => ({
        id: inv._id.toString(),
        homeId: inv.homeId._id.toString(),
        homeName: inv.homeId.name,
        role: inv.role,
      })),
    };
  },

  async acceptInvitation(userId: string, invitationId: string) {
    const uid = new Types.ObjectId(userId);
    await assertNoActiveOrPendingMembership(uid);

    const invite = await Membership.findOne({
      _id: new Types.ObjectId(invitationId),
      userId: uid,
      status: MembershipStatus.Invited,
    });
    if (!invite) throw ApiError.notFound('Invitation not found');

    invite.status = MembershipStatus.Active;
    invite.joinedAt = new Date();
    await invite.save();

    await User.updateOne({ _id: uid }, { activeMembershipId: invite._id });

    // Clean up any other invites or pending requests across all homes
    await Membership.deleteMany({
      userId: uid,
      status: { $in: [MembershipStatus.Invited, MembershipStatus.Pending] },
      _id: { $ne: invite._id },
    });

    Membership.find({ homeId: invite.homeId, status: MembershipStatus.Active, userId: { $ne: uid } })
      .distinct('userId')
      .then((memberUserIds) => {
        notificationService.createForHomeMembers(
          memberUserIds as Types.ObjectId[],
          invite.homeId as Types.ObjectId,
          NotificationType.MemberJoined,
          'A new member has accepted an invitation and joined your Home!',
        ).catch(() => {});
      })
      .catch(() => {});

    return { message: 'Invitation accepted' };
  },

  async rejectInvitation(userId: string, invitationId: string) {
    const uid = new Types.ObjectId(userId);
    const invite = await Membership.findOne({
      _id: new Types.ObjectId(invitationId),
      userId: uid,
      status: MembershipStatus.Invited,
    });
    if (!invite) throw ApiError.notFound('Invitation not found');

    await Membership.deleteOne({ _id: invite._id });
    return { message: 'Invitation rejected' };
  },

  async regenerateInviteCode(homeId: Types.ObjectId) {
    const home = await Home.findById(homeId);
    if (!home) throw ApiError.notFound('Home not found');

    home.inviteCode = generateInviteCode();
    await home.save();
    return { home: publicHome(home), inviteCode: home.inviteCode };
  },

  async exportHomeData(homeId: Types.ObjectId) {
    const home = await Home.findById(homeId).lean();
    if (!home) throw ApiError.notFound('Home not found');

    const members = await Membership.find({ homeId }).populate('userId', 'name email avatar').lean();

    return {
      exportedAt: new Date().toISOString(),
      home: {
        id: home._id.toString(),
        name: home.name,
        currentCycle: home.currentCycle,
        timezone: home.timezone,
        inviteCode: home.inviteCode,
        mealSettings: home.mealSettings,
        expenseTypes: home.expenseTypes,
      },
      members: members.map((m) => ({
        id: m._id.toString(),
        role: m.role,
        status: m.status,
        user: m.userId,
      })),
    };
  },
};
