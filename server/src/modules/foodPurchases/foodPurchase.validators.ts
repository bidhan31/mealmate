import { z } from 'zod';
import { FoodPurchaseStatus } from '../../config/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');
const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');

export const createFoodPurchaseSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        qty: z.number().positive(),
        price: z.number().min(0),
      }),
    )
    .min(1),
  date: dateKey,
  note: z.string().max(200).optional(),
});

export const reviewFoodPurchaseSchema = z.object({
  status: z.enum([FoodPurchaseStatus.Approved, FoodPurchaseStatus.Rejected]),
});

export const foodPurchaseIdParam = z.object({ id: objectId });
export const foodPurchaseListQuery = z.object({
  cycle: cycle.optional(),
  status: z.nativeEnum(FoodPurchaseStatus).optional(),
});
