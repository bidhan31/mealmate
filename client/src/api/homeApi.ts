import { apiClient } from './client';
import type { ApiEnvelope } from '@/types/auth';
import type { HomeDto, MemberDto, MyMembership, RoomDto } from '@/types/home';

export const homeApi = {
  create: (name: string, timezone?: string) =>
    apiClient.post<ApiEnvelope<{ home: HomeDto }>>('/homes', { name, timezone }),

  join: (inviteCode: string) =>
    apiClient.post<ApiEnvelope<{ membership: { id: string; status: string }; home: { id: string; name: string } }>>(
      '/homes/join',
      { inviteCode },
    ),

  myHome: () =>
    apiClient.get<ApiEnvelope<{ home: HomeDto | null; membership: MyMembership | null }>>('/homes/me'),

  cancelJoinRequest: () => apiClient.post<ApiEnvelope<{ message: string }>>('/homes/join-request/cancel', {}),

  updateSettings: (payload: Partial<Pick<HomeDto, 'name' | 'timezone' | 'mealSettings' | 'descoAccountNo'>>) =>
    apiClient.patch<ApiEnvelope<{ home: HomeDto }>>('/homes/settings', payload),

  updateExpenseTypes: (expenseTypes: { name: string; category: string; defaultAmount: number }[]) =>
    apiClient.put<ApiEnvelope<{ home: HomeDto }>>('/homes/expense-types', { expenseTypes }),

  leave: () => apiClient.post<ApiEnvelope<{ message: string }>>('/homes/leave', {}),

  listInvitations: () => apiClient.get<ApiEnvelope<{ invitations: { id: string; homeId: string; homeName: string; role: string }[] }>>('/homes/invitations'),
  acceptInvitation: (id: string) => apiClient.post<ApiEnvelope<{ message: string }>>(`/homes/invitations/${id}/accept`),
  rejectInvitation: (id: string) => apiClient.post<ApiEnvelope<{ message: string }>>(`/homes/invitations/${id}/reject`),

  regenerateInviteCode: () =>
    apiClient.post<ApiEnvelope<{ home: HomeDto; inviteCode: string }>>('/homes/regenerate-invite', {}),

  exportData: () =>
    apiClient.get<ApiEnvelope<Record<string, unknown>>>('/homes/export-data'),
};

export const membershipApi = {
  list: (status?: string) =>
    apiClient.get<ApiEnvelope<{ members: MemberDto[] }>>('/memberships', {
      params: status ? { status } : undefined,
    }),
  invite: (email: string) => apiClient.post<ApiEnvelope<{ message: string }>>(`/memberships/invite`, { email }),
  approve: (id: string) => apiClient.post<ApiEnvelope<{ message: string }>>(`/memberships/${id}/approve`),
  reject: (id: string) => apiClient.post<ApiEnvelope<{ message: string }>>(`/memberships/${id}/reject`),
  updateRole: (id: string, role: string) =>
    apiClient.patch<ApiEnvelope<{ message: string }>>(`/memberships/${id}/role`, { role }),
  remove: (id: string) => apiClient.delete<ApiEnvelope<{ message: string }>>(`/memberships/${id}`),
};

export const roomApi = {
  list: () => apiClient.get<ApiEnvelope<{ rooms: RoomDto[] }>>('/rooms'),
  create: (name: string, totalRent: number) =>
    apiClient.post<ApiEnvelope<{ room: RoomDto }>>('/rooms', { name, totalRent }),
  update: (id: string, payload: { name?: string; totalRent?: number }) =>
    apiClient.patch<ApiEnvelope<{ room: RoomDto }>>(`/rooms/${id}`, payload),
  remove: (id: string) => apiClient.delete<ApiEnvelope<{ message: string }>>(`/rooms/${id}`),
  assign: (membershipId: string, roomId: string | null) =>
    apiClient.post<ApiEnvelope<{ message: string }>>('/rooms/assign', { membershipId, roomId }),
};
