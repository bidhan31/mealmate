import { z } from 'zod';

const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const dashboardQuery = z.object({ cycle: cycle.optional() });

export const markPaidSchema = z.object({
  expenseId: objectId,
  isPaid: z.boolean(),
});
