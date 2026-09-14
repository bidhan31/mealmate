import { z } from 'zod';

const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');

export const dueListQuery = z.object({ cycle: cycle.optional() });
