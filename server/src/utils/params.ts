import { ApiError } from './ApiError';

export function asSingleString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : undefined;
  }
  if (value && typeof value === 'object') {
    const asRecord = value as Record<string, unknown>;
    if (typeof asRecord.value === 'string') return asRecord.value;
  }
  return undefined;
}

export function requireSingleString(value: unknown, fieldName: string): string {
  const normalized = asSingleString(value);
  if (!normalized || normalized.trim() === '') {
    throw ApiError.badRequest(`Missing ${fieldName}`);
  }
  return normalized;
}
