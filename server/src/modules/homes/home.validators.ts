import { z } from 'zod';
import { ExpenseCategory } from '../../config/enums';

export const createHomeSchema = z.object({
  name: z.string().min(2).max(80),
  timezone: z.string().optional(),
});

export const joinHomeSchema = z.object({
  inviteCode: z.string().min(4).max(16),
});

export const updateHomeSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  timezone: z.string().optional(),
  descoAccountNo: z.string().trim().max(40).optional().or(z.literal('')),
  mealSettings: z
    .object({
      breakfast: z.boolean().optional(),
      lunch: z.boolean().optional(),
      dinner: z.boolean().optional(),
    })
    .optional(),
});

export const updateExpenseTypesSchema = z.object({
  expenseTypes: z.array(
    z.object({
      name: z.string().min(1),
      category: z.nativeEnum(ExpenseCategory),
      defaultAmount: z.number().min(0),
    })
  ),
});
