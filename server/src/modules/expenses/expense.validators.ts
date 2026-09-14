import { z } from 'zod';
import { ExpenseCategory } from '../../config/enums';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const cycle = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid cycle (YYYY-MM)');

export const createExpenseSchema = z.object({
  purpose: z.string().min(1),
  type: z.nativeEnum(ExpenseCategory),
  amount: z.number().min(0),
  cycle: cycle,
  for: objectId.nullable().optional(),
  note: z.string().max(200).optional(),
});

export const expenseIdParam = z.object({ id: objectId });
export const expenseListQuery = z.object({ cycle: cycle.optional() });

export const updateExpenseSchema = z.object({
  amount: z.number().min(0).optional(),
  purpose: z.string().min(1).optional(),
  note: z.string().max(200).optional(),
});

export const initializeRentSchema = z.object({
  cycle: cycle,
});

export const initializeSharedSchema = z.object({
  cycle: cycle,
  expenses: z.array(z.object({
    purpose: z.string().min(1),
    amount: z.number().min(0)
  })).min(1),
});

export const initializeIndividualSchema = z.object({
  cycle: cycle,
  purpose: z.string().min(1),
  amount: z.number().min(0),
  for: objectId,
});
