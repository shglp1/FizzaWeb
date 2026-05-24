/** Client-side CSV export helpers for admin financials. */

import { formatSar } from './adminCurrency.ts';

export type PaymentExportRow = {
  user?: { fullName?: string | null } | null;
  email?: string | null;
  purpose?: string | null;
  amountSar?: string | number | null;
  status?: string | null;
  createdAt?: string | Date | null;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function paymentsToCsv(rows: PaymentExportRow[]): string {
  const header = ['User', 'Email', 'Purpose', 'Amount', 'Status', 'Date'];
  const lines = rows.map((row) => {
    const user = row.user?.fullName ?? '';
    const email = row.email ?? '';
    const purpose = row.purpose ?? '';
    const amount = formatSar(row.amountSar ?? 0);
    const status = row.status ?? '';
    const date = row.createdAt ? new Date(row.createdAt).toISOString() : '';
    return [user, email, purpose, amount, status, date].map(csvEscape).join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
