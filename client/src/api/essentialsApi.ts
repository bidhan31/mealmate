import { apiClient } from './client';
import type { ApiEnvelope } from '@/types/auth';
import type { EssentialDto, CreateEssentialPayload } from '@/types/essentials';

export const essentialsApi = {
  list: () => apiClient.get<ApiEnvelope<{ items: EssentialDto[] }>>('/essentials'),
  create: (payload: CreateEssentialPayload) =>
    apiClient.post<ApiEnvelope<{ item: EssentialDto }>>('/essentials', payload),
  update: (id: string, payload: Partial<CreateEssentialPayload>) =>
    apiClient.patch<ApiEnvelope<{ item: EssentialDto }>>(`/essentials/${id}`, payload),
  delete: (id: string) =>
    apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(`/essentials/${id}`),
};
