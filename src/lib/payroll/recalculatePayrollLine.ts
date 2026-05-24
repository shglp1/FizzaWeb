import { prisma } from '../prisma.ts';
import { calculatePeriodNetPay, roundKm } from './calculateTripEarning.ts';

export async function recalculatePayrollLine(lineId: string) {
  const line = await prisma.driverPayrollLine.findUnique({
    where: { id: lineId },
    include: { tripEarnings: true },
  });
  if (!line) return null;
  if (line.status === 'PAID') {
    throw new Error('Paid payroll lines cannot be recalculated');
  }

  const totals = line.tripEarnings.reduce(
    (acc, e) => ({
      tripCount: acc.tripCount + 1,
      totalBillableKm: acc.totalBillableKm + Number(e.billableKm),
      grossSar: acc.grossSar + Number(e.grossSar),
      platformFeeSar: acc.platformFeeSar + Number(e.platformFeeSar),
      tripNetSar: acc.tripNetSar + Number(e.netSar),
    }),
    { tripCount: 0, totalBillableKm: 0, grossSar: 0, platformFeeSar: 0, tripNetSar: 0 },
  );

  const netPaySar = calculatePeriodNetPay({
    tripNetSar: totals.tripNetSar,
    deductionsSar: Number(line.deductionsSar),
    bonusesSar: Number(line.bonusesSar),
  });

  return prisma.driverPayrollLine.update({
    where: { id: lineId },
    data: {
      tripCount: totals.tripCount,
      totalBillableKm: roundKm(totals.totalBillableKm),
      grossSar: totals.grossSar,
      platformFeeSar: totals.platformFeeSar,
      tripNetSar: totals.tripNetSar,
      netPaySar,
    },
  });
}
