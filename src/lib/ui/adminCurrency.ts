/** Consistent SAR formatting for admin financial displays. */
export function formatSar(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (Number.isNaN(n)) return '—';
  return `SAR ${n.toFixed(2)}`;
}

export function formatWallet(balance: string | number | null | undefined): string {
  return formatSar(balance);
}
