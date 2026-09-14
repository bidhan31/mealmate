export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface MealSlots {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface MealDto {
  id: string;
  membershipId: string;
  type: 'normal' | 'guest';
  count: number;
  slots: MealSlots | null; // null for guest meals
  slot: MealSlot | null; // set for guest meals only
  lockedSlots: MealSlot[]; // slots locked for this member on this date (home or self off)
  guestStatus: 'pending' | 'approved' | 'rejected' | null;
  note: string | null;
}

export interface MealDayDto {
  date: string;
  todayTotalMealCount: number;
  homeDisabledSlots: MealSlot[]; // slots turned off home-wide for this date
  meals: MealDto[];
}

export interface MonthlyMealSummary {
  cycle: string;
  homeTotalMealCount: number;
  byMember: { membershipId: string; totalMeals: number }[];
}

export interface MonthlyCalendarData {
  cycle: string;
  meals: {
    id: string;
    membershipId: string;
    date: string;
    type: 'normal' | 'guest';
    count: number;
    slots: MealSlots | null;
    slot: MealSlot | null;
    guestStatus: 'pending' | 'approved' | 'rejected' | null;
    note: string | null;
  }[];
}

export interface GuestRequestDto {
  id: string;
  membershipId: string;
  date: string;
  slot: MealSlot | null;
  count: number;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
}

export interface FoodPurchaseItem {
  name: string;
  qty: number;
  price: number;
}

export type FoodPurchaseStatus = 'pending' | 'approved' | 'rejected';

export interface FoodPurchaseDto {
  _id: string;
  membershipId: { _id: string; userId?: { _id: string; name?: string; email?: string } } | string;
  items: FoodPurchaseItem[];
  totalAmount: number;
  date: string;
  cycle: string;
  note?: string;
  status: FoodPurchaseStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export type ExpenseCategory = 'independently_counted' | 'equally_shared' | 'individual';

export type ExpenseStatus = 'unpaid' | 'paid';

export interface ExpenseOwner {
  _id: string;
  userId?: { _id: string; name?: string } | string;
}

export interface ExpenseDto {
  _id: string;
  type: ExpenseCategory;
  purpose: string;
  amount: number;
  for?: ExpenseOwner | string | null;
  date: string;
  cycle: string;
  note?: string;
  status: ExpenseStatus;
  paymentId?: string | null;
}

export interface MemberExpenseSummary {
  membershipId: string;
  userName: string;
  total: number;
  paid: number;
  unpaid: number;
  rent: number;
  shared: number;
  individual: number;
}

export interface ExpenseListResult {
  total: number;
  paidTotal: number;
  unpaidTotal: number;
  fixedTotal: number;
  byMember?: MemberExpenseSummary[];
  expenses: ExpenseDto[];
}

export interface ExpenseManageCategory {
  type: ExpenseCategory;
  count: number;
  total: number;
  paid: number;
  unpaid: number;
  items: ExpenseDto[];
}

export interface ExpenseManageResult {
  cycle: string;
  total: number;
  paid: number;
  unpaid: number;
  paidCount: number;
  unpaidCount: number;
  byMember?: MemberExpenseSummary[];
  categories: ExpenseManageCategory[];
}

export type DepositType = 'cash' | 'bank' | 'mobile' | 'other';

export interface DepositDto {
  _id: string;
  membershipId: { _id: string; userId?: { _id: string; name?: string } } | string;
  amount: number;
  depositType: DepositType;
  date: string;
  cycle: string;
}

export interface RefundDto {
  _id: string;
  membershipId: { _id: string; userId?: { _id: string; name?: string } } | string;
  amount: number;
  paymentMethod: DepositType;
  date: string;
  cycle: string;
  note?: string;
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export interface WalletDto {
  _id: string;
  membershipId: { _id: string; userId?: { _id: string; name?: string } } | string;
  balance: number;
}

export type WalletTxnType = 'credit' | 'debit';
export type WalletTxnSource = 'deposit' | 'payment' | 'refund' | 'reversal' | 'adjustment';

export interface WalletTransactionDto {
  _id: string;
  type: WalletTxnType;
  amount: number;
  balanceAfter: number;
  source: WalletTxnSource;
  note?: string;
  createdAt: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentStatus = 'paid' | 'rejected' | 'reversed';

export interface PaymentDto {
  _id: string;
  membershipId: { _id: string; userId?: { _id: string; name?: string } } | string;
  expenseId: string;
  amount: number;
  cycle: string;
  purpose: string;
  status: PaymentStatus;
  reason?: string;
  createdAt: string;
  reversedAt?: string | null;
}

export interface PaymentListResult {
  totalPaid: number;
  payments: PaymentDto[];
}

export interface MemberDueRow {
  membershipId: string;
  userId: string;
  userName: string;
  roomId: string | null;
  mealCount: number;
  mealCost: number;
  rentShare: number;
  utilityShare: number;
  utilities?: { purpose: string; amount: number }[];
  individualShare: number;
  fixedShare: number;
  charge: number;
  deposits: number;
  refunds?: number;
  foodPurchases: number;
  credit: number;
  carriedOverBalance: number;
  walletBalance?: number;
  expensePaid?: number;
  expenseUnpaid?: number;
  pendingDues?: number;
  due: number;
}

export interface DuesSummary {
  cycle: string;
  mealRate: number;
  homeTotalMeals: number;
  totalFoodPurchases: number;
  totalFixedExpenses: number;
  totalDeposits: number;
  totalRefunds?: number;
  activeMemberCount: number;
  members: MemberDueRow[];
}

export interface DashboardExpenseInstance {
  expenseId: string;
  purpose: string;
  type: ExpenseCategory;
  amount: number;
  status: ExpenseStatus;
  paymentId: string | null;
  createdAt?: string;
}

export interface DashboardSummary {
  cycle: string;
  activeMemberCount: number;
  meals: { homeTotal: number; today: number };
  finance: {
    foodPurchases: number;
    expenses: number;
    fixedExpenses: number;
    deposits: number;
    mealRate: number;
    walletBalanceTotal: number;
  };
  dues: { totalOutstanding: number; totalAdvance: number; membersInDue: number };
  expenses: { total: number; paid: number; unpaid: number };
  utilityColumns: string[];
  expenseByType: { type: string; amount: number }[];
  depositTrend: { date: string; amount: number }[];
  members: {
    membershipId: string;
    userName: string;
    mealCount: number;
    mealCost: number;
    due: number;
    walletBalance: number;
    expenses: DashboardExpenseInstance[];
    expenseTotal: number;
    expensePaid: number;
    expenseUnpaid: number;
  }[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  type: string;
  message: string;
  read: boolean;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationList {
  unreadCount: number;
  notifications: NotificationDto[];
}

export interface NotificationPrefsDto {
  prefs: Record<string, boolean>;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogDto {
  id: string;
  actorName: string;
  action: string;
  targetModel: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogList {
  total: number;
  logs: AuditLogDto[];
}

// ─── Month-End Close ─────────────────────────────────────────────────────────

export interface MonthCycleTotals {
  meals: number;
  foodPurchases: number;
  expenses: number;
  fixedExpenses: number;
  deposits: number;
  totalCharge: number;
  totalCredit: number;
  totalDue: number;
}

export interface MonthCycleMemberSnapshot {
  membershipId: string;
  userName: string;
  due: number;
  carriedOver: number;
}

export interface MonthCycleDto {
  id: string;
  cycle: string;
  status: 'open' | 'closed';
  mealRate: number;
  totals: MonthCycleTotals;
  memberSnapshot: MonthCycleMemberSnapshot[];
  closedAt: string | null;
}

export interface CycleStatusDto {
  cycle: string;
  status: 'open' | 'closed';
  closedAt: string | null;
}

export interface CloseMonthResult {
  cycle: string;
  status: string;
  nextCycle: string;
  mealRate: number;
  totalOutstanding: number;
  memberCount: number;
}

// ─── Refund Preview & Validation ─────────────────────────────────────────────

export interface RefundPreviewDto {
  membershipId: string;
  cycle: string;
  netDue: number;
  walletBalance: number;
  mealCostDue: number;
  unpaidLiabilities: number;
  maxRefundable: number;
  minRefundable: number;
  canRefund: boolean;
  foodExcess: number;
  hasFoodExcessNotDeposited: boolean;
  mealCost: number;
  foodPurchases: number;
  mealFoodDiff: number;
  expensePaid: number;
  expenseUnpaid: number;
  deposits: number;
  refunds: number;
  carriedOverBalance: number;
  charge: number;
}

export interface RefundValidationDto {
  valid: boolean;
  error: string | null;
  walletBalance: number;
  mealCostDue: number;
  maxRefundable: number;
  walletAfter: number;
  refundAmount: number;
  isFullWalletRefund?: boolean;
}
