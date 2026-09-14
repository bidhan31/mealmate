import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { AuthedRequest } from './requireAuth';
import { Membership } from '../modules/memberships/membership.model';
import { MembershipStatus, Role } from '../config/enums';
import { IMembership } from '../modules/memberships/membership.model';

export interface HomeScopedRequest extends AuthedRequest {
  membership?: IMembership;
}

/**
 * Loads the caller's ACTIVE membership and attaches it as req.membership.
 * Must run after requireAuth. Rejects users who are not active members of a home.
 */
export async function loadMembership(
  req: HomeScopedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const membership = await Membership.findOne({
      userId: new Types.ObjectId(req.user!.id),
      status: MembershipStatus.Active,
    });
    if (!membership) {
      return next(ApiError.forbidden('You are not an active member of any home'));
    }
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires the caller's active membership to have the Admin role. */
export function requireAdmin(
  req: HomeScopedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.membership) return next(ApiError.forbidden('Membership context missing'));
  if (req.membership.role !== Role.Admin) {
    return next(ApiError.forbidden('Admin privileges required'));
  }
  next();
}
