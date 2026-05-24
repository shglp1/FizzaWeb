import { prisma } from '../prisma.ts';
import {
  isMultiVendorConfigured,
  transferBalance,
} from '../payments/myfatoorahSuppliers.ts';
import { PaymentGatewayError } from '../payments/types.ts';

export type PayoutResult = {
  method: 'MANUAL' | 'MYFATOORAH';
  payoutRef: string | null;
};

export async function processPayrollPayout(lineId: string): Promise<PayoutResult> {
  const line = await prisma.driverPayrollLine.findUnique({
    where: { id: lineId },
    include: {
      driver: {
        include: {
          profile: { include: { user: { select: { email: true } } } },
          payProfile: true,
        },
      },
      payrollRun: { select: { year: true, month: true } },
    },
  });

  if (!line) throw new Error('Payroll line not found');
  if (line.status !== 'APPROVED') throw new Error('Line must be approved before payout');

  const netPaySar = Number(line.netPaySar);
  const profile = line.driver.payProfile;
  const useMyFatoorah = isMultiVendorConfigured()
    && profile?.myfatoorahSupplierCode
    && profile.supplierStatus === 'APPROVED';

  if (useMyFatoorah && profile?.myfatoorahSupplierCode) {
    try {
      const transfer = await transferBalance({
        supplierCode: profile.myfatoorahSupplierCode,
        transferAmount: netPaySar,
        transferType: 'push',
        internalNotes: `Fizza payroll ${line.payrollRun.year}-${String(line.payrollRun.month).padStart(2, '0')} line ${line.id}`,
      });

      return {
        method: 'MYFATOORAH',
        payoutRef: String(transfer.InvoiceId),
      };
    } catch (err) {
      const message = err instanceof PaymentGatewayError
        ? err.providerMessage ?? err.message
        : err instanceof Error ? err.message : 'Payout failed';

      await prisma.driverPayrollLine.update({
        where: { id: lineId },
        data: { payoutError: message },
      });
      throw new Error(message);
    }
  }

  return { method: 'MANUAL', payoutRef: null };
}
