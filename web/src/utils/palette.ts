/** 账户/分类配色板（兼顾深浅主题可读性） */
export const PALETTE = [
  '#2f6bff',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
] as const;

/** 按已用数量挑选下一个配色，循环复用 */
export function nextColor(usedCount: number): string {
  return PALETTE[usedCount % PALETTE.length];
}

/** 随机取一个配色 */
export function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}
