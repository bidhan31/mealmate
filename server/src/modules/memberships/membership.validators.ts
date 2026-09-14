import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const membershipIdParam = z.object({ id: objectId });

export const listMembersQuery = z.object({
  status: z.enum(['pending', 'active', 'removed', 'invited']).optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export const inviteSchema = z.object({
  email: z.string().email(),
});
