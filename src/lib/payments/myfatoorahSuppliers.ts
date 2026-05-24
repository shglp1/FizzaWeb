import 'server-only';
import { PaymentGatewayError } from './types';

export function isMultiVendorConfigured(): boolean {
  return !!(
    process.env.MYFATOORAH_API_KEY?.trim() &&
    process.env.MYFATOORAH_BASE_URL?.trim() &&
    process.env.MYFATOORAH_MULTI_VENDOR_ENABLED !== 'false'
  );
}

function getConfig() {
  const apiKey = process.env.MYFATOORAH_API_KEY?.trim();
  const baseUrl = process.env.MYFATOORAH_BASE_URL?.trim();
  if (!apiKey || !baseUrl) {
    throw new PaymentGatewayError(
      'MyFatoorah is not configured.',
      'NOT_CONFIGURED',
    );
  }
  return { apiKey, baseUrl };
}

async function mfFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const { apiKey, baseUrl } = getConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new PaymentGatewayError(
      'Could not reach MyFatoorah.',
      'PAYMENT_GATEWAY_NETWORK_ERROR',
      { providerMessage: err instanceof Error ? err.message : String(err) },
    );
  }

  let body: {
    IsSuccess?: boolean;
    Message?: string;
    Data?: T;
  } | null = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || !body?.IsSuccess) {
    throw new PaymentGatewayError(
      body?.Message ?? 'MyFatoorah request failed.',
      'PAYMENT_GATEWAY_HTTP_ERROR',
      { providerStatus: response.status, providerMessage: body?.Message },
    );
  }

  return body.Data as T;
}

export type CreateSupplierParams = {
  supplierName: string;
  mobile: string;
  email: string;
  bankId: string;
  bankAccountHolderName: string;
  bankAccount: string;
  iban: string;
};

export type CreateSupplierResult = {
  SupplierCode: number;
  SupplierEmail?: string;
  Date?: string;
};

export async function createSupplier(params: CreateSupplierParams): Promise<CreateSupplierResult> {
  if (!isMultiVendorConfigured()) {
    throw new PaymentGatewayError(
      'MyFatoorah Multi-Vendors is not enabled.',
      'NOT_CONFIGURED',
    );
  }

  return mfFetch<CreateSupplierResult>('/v2/CreateSupplier', {
    method: 'POST',
    body: JSON.stringify({
      SupplierName: params.supplierName,
      Mobile: params.mobile,
      Email: params.email,
      BankId: params.bankId,
      BankAccountHolderName: params.bankAccountHolderName,
      BankAccount: params.bankAccount,
      Iban: params.iban,
      DepositTerms: 'Weekly',
      IsActive: 'true',
      BusinessType: 1,
    }),
  });
}

export type TransferBalanceParams = {
  supplierCode: number;
  transferAmount: number;
  transferType: 'push' | 'pull';
  internalNotes?: string;
};

export type TransferBalanceResult = {
  InvoiceId: number;
  Date?: string;
};

export async function transferBalance(params: TransferBalanceParams): Promise<TransferBalanceResult> {
  if (!isMultiVendorConfigured()) {
    throw new PaymentGatewayError(
      'MyFatoorah Multi-Vendors is not enabled.',
      'NOT_CONFIGURED',
    );
  }

  if (params.transferAmount <= 0) {
    throw new PaymentGatewayError(
      'Transfer amount must be greater than zero.',
      'INVALID_PARAMS',
    );
  }

  return mfFetch<TransferBalanceResult>('/v2/TransferBalance', {
    method: 'POST',
    body: JSON.stringify({
      SupplierCode: params.supplierCode,
      TransferAmount: params.transferAmount,
      TransferType: params.transferType,
      InternalNotes: params.internalNotes ?? '',
    }),
  });
}

export type SupplierDashboard = {
  TotalAwaitingBalance?: number;
  TotalDepositedAmount?: number;
  IsApproved?: boolean;
  IsActive?: boolean;
};

export async function getSupplierDashboard(supplierCode: number): Promise<SupplierDashboard> {
  return mfFetch<SupplierDashboard>(`/v2/GetSupplierDashboard?SupplierCode=${supplierCode}`, {
    method: 'GET',
  });
}
