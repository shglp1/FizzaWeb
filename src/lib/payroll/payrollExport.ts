import { formatSar } from '../ui/adminCurrency.ts';

export type PayrollExportLine = {
  driverName: string;
  driverEmail: string;
  tripCount: number;
  totalBillableKm: number | string;
  grossSar: number | string;
  platformFeeSar: number | string;
  tripNetSar: number | string;
  deductionsSar: number | string;
  bonusesSar: number | string;
  netPaySar: number | string;
  status: string;
  payoutMethod?: string | null;
  payoutRef?: string | null;
  paidAt?: string | Date | null;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function payrollLinesToCsv(lines: PayrollExportLine[]): string {
  const header = [
    'Driver',
    'Email',
    'Trips',
    'Billable km',
    'Gross',
    'Platform fee',
    'Trip net',
    'Deductions',
    'Bonuses',
    'Net pay',
    'Status',
    'Payout method',
    'Payout ref',
    'Paid at',
  ];

  const rows = lines.map((line) => [
    line.driverName,
    line.driverEmail,
    String(line.tripCount),
    String(line.totalBillableKm),
    formatSar(line.grossSar),
    formatSar(line.platformFeeSar),
    formatSar(line.tripNetSar),
    formatSar(line.deductionsSar),
    formatSar(line.bonusesSar),
    formatSar(line.netPaySar),
    line.status,
    line.payoutMethod ?? '',
    line.payoutRef ?? '',
    line.paidAt ? new Date(line.paidAt).toISOString() : '',
  ].map(csvEscape).join(','));

  return [header.join(','), ...rows].join('\n');
}
