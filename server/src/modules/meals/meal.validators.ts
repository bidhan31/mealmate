import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');
const slotEnum = z.enum(['breakfast', 'lunch', 'dinner']);

// Set per-slot state (breakfast/lunch/dinner) for a member on a single day.
export const setMealSchema = z
  .object({
    date: dateKey,
    slots: z
      .object({
        breakfast: z.boolean().optional(),
        lunch: z.boolean().optional(),
        dinner: z.boolean().optional(),
      })
      .refine((s) => Object.keys(s).length > 0, 'At least one slot is required'),
    membershipId: objectId.optional(),
  });

// Turn off selected slots across a date range (self or, for admins, home-wide).
export const disableSlotsSchema = z.object({
  slots: z.array(slotEnum).min(1),
  from: dateKey,
  to: dateKey,
  scope: z.enum(['self', 'home']).default('self'),
});

export const removeHomeWindowSchema = z.object({ windowId: objectId });

export const closeDaySchema = z.object({
  date: dateKey,
});

export const dateQuery = z.object({ date: dateKey.optional() });

export const cycleQuery = z.object({
  cycle: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)')
    .optional(),
});

export const guestMealSchema = z.object({
  date: dateKey,
  slot: slotEnum,
  count: z.number().int().min(1).max(20),
  note: z.string().max(200).optional(),
});

export const mealIdParam = z.object({ id: objectId });

export const guestStatusQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});
