import { z } from 'zod';
import { PaymentStatus } from '../../config/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');

export const paymentListQuery = z.object({
  cycle: cycle.optional(),
  membershipId: objectId.optional(),
  status: z.nativeEnum(PaymentStatus).optional(),
});

export const paymentIdParam = z.object({ id: objectId });

export const reversePaymentSchema = z.object({
  reason: z.string().max(300).optional(),
});
