import { apiClient } from './client';
import type { ApiEnvelope } from '@/types/auth';
import type {
  AuditLogList,
  CloseMonthResult,
  CycleStatusDto,
  DepositDto,
  DepositType,
  DuesSummary,
  DashboardSummary,
  ExpenseDto,
  ExpenseListResult,
  ExpenseManageResult,
  FoodPurchaseDto,
  FoodPurchaseItem,
  GuestRequestDto,
  MealDayDto,
  MealSlot,
  MealSlots,
  MonthlyCalendarData,
  MonthlyMealSummary,
  MonthCycleDto,
  NotificationList,
  NotificationPrefsDto,
  PaymentListResult,
  RefundDto,
  RefundPreviewDto,
  RefundValidationDto,
  WalletDto,
  WalletTransactionDto,
} from '@/types/finance';


export const mealApi = {
  setMeal: (date: string, slots: Partial<MealSlots>, membershipId?: string) =>
    apiClient.put<ApiEnvelope<{ meal: { id: string } }>>('/meals', { date, slots, membershipId }),
  disableSlots: (payload: {
    slots: MealSlot[];
    from: string;
    to: string;
    scope: 'self' | 'home';
  }) => apiClient.post<ApiEnvelope<{ message: string; affectedDays?: number }>>('/meals/disable-slots', payload),
  removeHomeWindow: (windowId: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/meals/remove-home-window', { windowId }),
  removeMemberWindow: (windowId: string) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/meals/remove-member-window', { windowId }),
  byDate: (date?: string) =>
    apiClient.get<ApiEnvelope<MealDayDto>>('/meals', { params: date ? { date } : undefined }),
  monthly: (cycle?: string) =>
    apiClient.get<ApiEnvelope<MonthlyMealSummary>>('/meals/monthly', {
      params: cycle ? { cycle } : undefined,
    }),
  monthlyCalendar: (cycle?: string) =>
    apiClient.get<ApiEnvelope<MonthlyCalendarData>>('/meals/monthly-calendar', {
      params: cycle ? { cycle } : undefined,
    }),
  requestGuest: (date: string, slot: MealSlot, count: number, note?: string) =>
    apiClient.post<ApiEnvelope<{ meal: { id: string } }>>('/meals/guest', { date, slot, count, note }),
  guestRequests: (status?: string) =>
    apiClient.get<ApiEnvelope<{ requests: GuestRequestDto[] }>>('/meals/guest', {
      params: status ? { status } : undefined,
    }),
  approveGuest: (id: string) => apiClient.post<ApiEnvelope<unknown>>(`/meals/guest/${id}/approve`),
  rejectGuest: (id: string) => apiClient.post<ApiEnvelope<unknown>>(`/meals/guest/${id}/reject`),
  closeDay: (date: string) => apiClient.post<ApiEnvelope<unknown>>('/meals/close-day', { date }),
};

export const foodPurchaseApi = {
  list: (cycleOrParams?: string | { cycle?: string; status?: string }) => {
    const params = typeof cycleOrParams === 'string' ? { cycle: cycleOrParams } : cycleOrParams;
    return apiClient.get<ApiEnvelope<{ total: number; pendingCount?: number; purchases: FoodPurchaseDto[] }>>('/food-purchases', {
      params,
    });
  },
  create: (items: FoodPurchaseItem[], date: string, note?: string) =>
    apiClient.post<ApiEnvelope<{ purchase: FoodPurchaseDto }>>('/food-purchases', {
      items,
      date,
      note,
    }),
  review: (id: string, status: 'approved' | 'rejected') =>
    apiClient.patch<ApiEnvelope<{ purchase: FoodPurchaseDto }>>(`/food-purchases/${id}/review`, { status }),
  remove: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`/food-purchases/${id}`),
};

export const expenseApi = {
  list: (cycle?: string) =>
    apiClient.get<ApiEnvelope<ExpenseListResult>>('/expenses', {
      params: cycle ? { cycle } : undefined,
    }),
  manage: (cycle?: string) =>
    apiClient.get<ApiEnvelope<ExpenseManageResult>>('/expenses/manage', {
      params: cycle ? { cycle } : undefined,
    }),
  create: (payload: {
    purpose: string;
    type: string;
    amount: number;
    cycle: string;
    for?: string;
    note?: string;
  }) => apiClient.post<ApiEnvelope<{ expense: ExpenseDto }>>('/expenses', payload),
  initializeRent: (payload: { cycle: string }) =>
    apiClient.post<ApiEnvelope<{ expenses: ExpenseDto[] }>>('/expenses/initialize/rent', payload),
  initializeShared: (payload: { cycle: string; expenses: { purpose: string; amount: number }[] }) =>
    apiClient.post<ApiEnvelope<{ expenses: ExpenseDto[] }>>('/expenses/initialize/shared', payload),
  initializeIndividual: (payload: { cycle: string; purpose: string; amount: number; for: string }) =>
    apiClient.post<ApiEnvelope<{ expenses: ExpenseDto[] }>>('/expenses/initialize/individual', payload),
  update: (id: string, payload: { amount?: number; purpose?: string; note?: string }) =>
    apiClient.patch<ApiEnvelope<{ expense: ExpenseDto }>>(`/expenses/${id}`, payload),
  remove: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`/expenses/${id}`),
};

export const depositApi = {
  list: (cycle?: string) =>
    apiClient.get<ApiEnvelope<{ total: number; deposits: DepositDto[] }>>('/deposits', {
      params: cycle ? { cycle } : undefined,
    }),
  create: (payload: {
    membershipId: string;
    amount: number;
    depositType?: DepositType;
    date: string;
  }) => apiClient.post<ApiEnvelope<{ deposit: DepositDto }>>('/deposits', payload),
  remove: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`/deposits/${id}`),
};

export const refundApi = {
  list: (cycle?: string) =>
    apiClient.get<ApiEnvelope<{ total: number; refunds: RefundDto[] }>>('/refunds', {
      params: cycle ? { cycle } : undefined,
    }),
  create: (payload: {
    membershipId: string;
    amount: number;
    paymentMethod?: DepositType;
    date: string;
    note?: string;
  }) => apiClient.post<ApiEnvelope<{ refund: RefundDto }>>('/refunds', payload),
  remove: (id: string) => apiClient.delete<ApiEnvelope<unknown>>(`/refunds/${id}`),

  /** Live settlement snapshot for a member in a given cycle. Read-only. */
  preview: (membershipId: string, cycle: string) =>
    apiClient.get<ApiEnvelope<RefundPreviewDto>>('/refunds/preview', {
      params: { membershipId, cycle },
    }),

  /** Dry-run validation of a proposed refund amount. Read-only. */
  validate: (payload: { membershipId: string; amount: number; date: string }) =>
    apiClient.post<ApiEnvelope<RefundValidationDto>>('/refunds/validate', payload),
};

export const walletApi = {
  list: () => apiClient.get<ApiEnvelope<{ wallets: WalletDto[] }>>('/wallets'),
  transactions: (membershipId: string) =>
    apiClient.get<ApiEnvelope<{ transactions: WalletTransactionDto[] }>>(
      `/wallets/${membershipId}/transactions`,
    ),
};

export const paymentApi = {
  list: (params?: { cycle?: string; membershipId?: string; status?: string }) =>
    apiClient.get<ApiEnvelope<PaymentListResult>>('/payments', { params }),
  reverse: (id: string, reason?: string) =>
    apiClient.post<ApiEnvelope<unknown>>(`/payments/${id}/reverse`, { reason }),
};

export const dueApi = {
  list: (cycle?: string) =>
    apiClient.get<ApiEnvelope<DuesSummary>>('/dues', { params: cycle ? { cycle } : undefined }),
};

export const dashboardApi = {
  summary: (cycle?: string) =>
    apiClient.get<ApiEnvelope<DashboardSummary>>('/dashboard/summary', {
      params: cycle ? { cycle } : undefined,
    }),
  markPaid: (payload: { expenseId: string; isPaid: boolean }) =>
    apiClient.post<ApiEnvelope<{ success: boolean; rejected: boolean; status: string; reason?: string; balance?: number; paymentId?: string; expenseId: string }>>(
      '/dashboard/mark-paid',
      payload,
    ),
};

export const notificationApi = {
  list: () => apiClient.get<ApiEnvelope<NotificationList>>('/notifications'),
  markRead: (id: string) => apiClient.patch<ApiEnvelope<null>>(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch<ApiEnvelope<null>>('/notifications/read-all'),
  getPrefs: () => apiClient.get<ApiEnvelope<NotificationPrefsDto>>('/notifications/prefs'),
  updatePrefs: (prefs: Record<string, boolean>) =>
    apiClient.patch<ApiEnvelope<NotificationPrefsDto>>('/notifications/prefs', prefs),
};


export const auditLogApi = {
  list: (params?: { limit?: number; skip?: number; action?: string }) =>
    apiClient.get<ApiEnvelope<AuditLogList>>('/audit-logs', { params }),
};

export const monthEndApi = {
  close: (cycle?: string) =>
    apiClient.post<ApiEnvelope<CloseMonthResult>>('/month-end/close', { cycle }),
  history: () =>
    apiClient.get<ApiEnvelope<{ cycles: MonthCycleDto[] }>>('/month-end/history'),
  status: (cycle?: string) =>
    apiClient.get<ApiEnvelope<CycleStatusDto>>('/month-end/status', {
      params: cycle ? { cycle } : undefined,
    }),
};
