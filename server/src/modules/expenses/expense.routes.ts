import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { loadMembership, requireAdmin } from '../../middleware/rbac';
import { expenseController } from './expense.controller';
import {
  createExpenseSchema,
  expenseIdParam,
  expenseListQuery,
  updateExpenseSchema,
  initializeRentSchema,
  initializeSharedSchema,
  initializeIndividualSchema,
} from './expense.validators';

const router = Router();

router.use(requireAuth, loadMembership);

router.get('/', validate({ query: expenseListQuery }), expenseController.list);
router.get('/manage', requireAdmin, validate({ query: expenseListQuery }), expenseController.manage);
router.post('/', requireAdmin, validate({ body: createExpenseSchema }), expenseController.create);
router.post('/initialize/rent', requireAdmin, validate({ body: initializeRentSchema }), expenseController.initializeRent);
router.post('/initialize/shared', requireAdmin, validate({ body: initializeSharedSchema }), expenseController.initializeShared);
router.post('/initialize/individual', requireAdmin, validate({ body: initializeIndividualSchema }), expenseController.initializeIndividual);
router.patch('/:id', requireAdmin, validate({ params: expenseIdParam, body: updateExpenseSchema }), expenseController.update);
router.delete('/:id', requireAdmin, validate({ params: expenseIdParam }), expenseController.remove);

export default router;
