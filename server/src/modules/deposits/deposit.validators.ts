import { z } from 'zod';
import { DepositType } from '../../config/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');
const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');

export const createDepositSchema = z.object({
  membershipId: objectId,
  amount: z.coerce.number().positive(),
  depositType: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.nativeEnum(DepositType).optional(),
  ),
  date: dateKey,
});

export const depositIdParam = z.object({ id: objectId });
export const depositListQuery = z.object({ cycle: cycle.optional() });
