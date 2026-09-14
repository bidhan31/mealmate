import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const roomIdParam = z.object({ id: objectId });

export const createRoomSchema = z.object({
  name: z.string().min(1).max(60),
  totalRent: z.number().min(0),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  totalRent: z.number().min(0).optional(),
});

export const assignRoomSchema = z.object({
  membershipId: objectId,
  roomId: objectId.nullable(),
});
