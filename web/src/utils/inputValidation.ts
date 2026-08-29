import { DATA_LIMITS } from '@/config/dataLimits';

export function normalizedEditorName(value: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error('INVALID_NAME');
  return normalized;
}

export function normalizedEditorNote(value?: string): string | undefined {
  const normalized = value?.trim() ?? '';
  if (normalized.length > DATA_LIMITS.noteInput) throw new Error('INVALID_NOTE');
  return normalized || undefined;
}

export function assertSafeMoney(value: number, allowsZero = false): void {
  if (!Number.isSafeInteger(value) || (!allowsZero && value === 0)) throw new Error('INVALID_AMOUNT');
}
