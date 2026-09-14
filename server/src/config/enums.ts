/**
 * Shared enums reused across Deposit / Expense / Due / Meal schemas.
 * Keeping these centralized prevents calculation mismatches (per spec DEV NOTE).
 */

export enum Role {
  Admin = 'admin',
  Member = 'member',
}

export enum MembershipStatus {
  Pending = 'pending',
  Active = 'active',
  Removed = 'removed',
  Invited = 'invited',
}

export enum MealType {
  Normal = 'normal',
  Guest = 'guest',
}

export enum MealSlot {
  Breakfast = 'breakfast',
  Lunch = 'lunch',
  Dinner = 'dinner',
}

export enum GuestMealStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum FoodPurchaseStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum ExpenseCategory {
  IndependentlyCounted = 'independently_counted',
  EquallyShared = 'equally_shared',
  Individual = 'individual',
}

export enum DepositType {
  Cash = 'cash',
  Bank = 'bank',
  Mobile = 'mobile', // bKash / Nagad etc.
  Other = 'other',
}

/** Direction of a wallet ledger entry. */
export enum WalletTxnType {
  Credit = 'credit', // money into wallet (increases balance)
  Debit = 'debit', // money out of wallet (decreases balance)
}

/** What caused a wallet ledger entry. Ledger is append-only; corrections use compensating entries. */
export enum WalletTxnSource {
  Deposit = 'deposit', // admin recorded a deposit → CREDIT
  Payment = 'payment', // an expense was paid → DEBIT
  Refund = 'refund', // cash refunded to member → DEBIT
  Reversal = 'reversal', // a deposit/payment was undone → compensating entry
  Adjustment = 'adjustment', // manual admin correction
  MonthClose = 'month_close', // wallet reconciled at month-end close → DEBIT (surplus settlement) or CREDIT (due carryover)
}

/** Lifecycle of a Payment attempt against a specific expense instance. */
export enum PaymentStatus {
  Paid = 'paid', // succeeded: wallet debited, expense marked paid
  Rejected = 'rejected', // failed (e.g. insufficient funds): recorded for audit, no wallet movement
  Reversed = 'reversed', // a previously-paid payment was undone: wallet refunded, expense reopened
}

/** Whether an expense instance has been settled from the member's wallet. */
export enum ExpenseStatus {
  Unpaid = 'unpaid',
  Paid = 'paid',
}

export enum CycleStatus {
  Open = 'open',
  Closed = 'closed',
}

export enum NotificationType {
  FoodTurn = 'food_turn',
  NewDue = 'new_due',
  GuestMealRequested = 'guest_meal_requested',
  GuestMealResolved = 'guest_meal_resolved',
  MonthClosed = 'month_closed',
  MemberJoined = 'member_joined',
  InvitationReceived = 'invitation_received',
  JoinRequestSubmitted = 'join_request_submitted',
  JoinRequestApproved = 'join_request_approved',
  JoinRequestRejected = 'join_request_rejected',
  MemberRemoved = 'member_removed',
  MemberLeft = 'member_left',
  AdminRoleTransferred = 'admin_role_transferred',
  HomeSettingsUpdated = 'home_settings_updated',
  RoomAssigned = 'room_assigned',
  RoomRentUpdated = 'room_rent_updated',
  MealCutoffWarning = 'meal_cutoff_warning',
  MealModifiedByAdmin = 'meal_modified_by_admin',
  NewFoodPurchase = 'new_food_purchase',
  FoodPurchaseStatusChanged = 'food_purchase_status_changed',
  NewExpenseAdded = 'new_expense_added',
  ExpenseStatusChanged = 'expense_status_changed',
  DepositRecorded = 'deposit_recorded',
  DepositStatusChanged = 'deposit_status_changed',
  RefundRecorded = 'refund_recorded',
  WalletBalanceUpdated = 'wallet_balance_updated',
  LowWalletBalance = 'low_wallet_balance',
  AdminOverride = 'admin_override',
}

/** ISO currency — fixed to BDT for v1. */
export const CURRENCY = 'BDT';
