import { z } from 'zod';
import { DepositType } from '../../config/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership ID');
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const cycleKey = z.string().regex(/^\d{4}-\d{2}$/, 'Cycle must be YYYY-MM');

export const createRefundSchema = z.object({
  membershipId: objectId,
  amount: z.coerce.number().positive('Refund amount must be positive'),
  paymentMethod: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.nativeEnum(DepositType).optional(),
  ),
  date: dateKey,
  note: z.string().optional(),
});

/** GET /refunds/preview?membershipId=...&cycle=... */
export const refundPreviewQuery = z.object({
  membershipId: objectId,
  cycle: cycleKey,
});

/** POST /refunds/validate — dry-run check before submitting */
export const validateRefundSchema = z.object({
  membershipId: objectId,
  amount: z.coerce.number().positive('Amount must be positive'),
  date: dateKey,
});

export const refundIdParam = z.object({
  id: objectId,
});

export const refundListQuery = z.object({
  cycle: cycleKey.optional(),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type RefundPreviewQuery = z.infer<typeof refundPreviewQuery>;
export type ValidateRefundInput = z.infer<typeof validateRefundSchema>;

