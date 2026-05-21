import 'server-only';

// Reads from env (server-side only):
// MYFATOORAH_API_KEY
// MYFATOORAH_BASE_URL  (e.g. https://apitest.myfatoorah.com for sandbox)
// MYFATOORAH_WEBHOOK_SECRET
// APP_URL

export function isConfigured(): boolean {
  return !!(process.env.MYFATOORAH_API_KEY && process.env.MYFATOORAH_BASE_URL);
}

export type CreateInvoiceParams = {
  amountSar: number;
  customerName: string;
  customerEmail: string;
  customerReference: string; // our Payment.id
};

export type InvoiceResult = {
  invoiceId: string;
  invoiceUrl: string;
};

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
  if (!isConfigured()) {
    throw new Error('MyFatoorah is not configured. Set MYFATOORAH_API_KEY and MYFATOORAH_BASE_URL.');
  }

  const baseUrl = process.env.MYFATOORAH_BASE_URL!;
  const apiKey = process.env.MYFATOORAH_API_KEY!;
  const appUrl = process.env.APP_URL ?? '';

  const body = {
    NotificationOption: 'LNK',
    CustomerName: params.customerName,
    InvoiceValue: params.amountSar,
    CurrencyIso: 'SAR',
    CallBackUrl: `${appUrl}/api/payments/webhook`,
    ErrorUrl: `${appUrl}/wallet`,
    Language: 'AR',
    CustomerEmail: params.customerEmail,
    CustomerReference: params.customerReference,
  };

  const response = await fetch(`${baseUrl}/v2/SendPayment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`MyFatoorah API error: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.IsSuccess) {
    throw new Error(`MyFatoorah API returned failure: ${data.Message ?? 'Unknown error'}`);
  }

  return {
    invoiceId: String(data.Data.InvoiceId),
    invoiceUrl: data.Data.InvoiceURL,
  };
}

export type PaymentStatusResult = {
  status: 'PAID' | 'FAILED' | 'PENDING';
  invoiceId: string;
  customerReference: string | null;
};

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
  if (!isConfigured()) {
    throw new Error('MyFatoorah is not configured. Set MYFATOORAH_API_KEY and MYFATOORAH_BASE_URL.');
  }

  const baseUrl = process.env.MYFATOORAH_BASE_URL!;
  const apiKey = process.env.MYFATOORAH_API_KEY!;

  const response = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ Key: paymentId, KeyType: 'PaymentId' }),
  });

  if (!response.ok) {
    throw new Error(`MyFatoorah GetPaymentStatus API error: HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.IsSuccess) {
    throw new Error(`MyFatoorah GetPaymentStatus returned failure: ${data.Message ?? 'Unknown error'}`);
  }

  const invoiceStatus: string = data.Data.InvoiceStatus;
  let status: 'PAID' | 'FAILED' | 'PENDING';
  if (invoiceStatus === 'Paid') {
    status = 'PAID';
  } else if (invoiceStatus === 'Failed' || invoiceStatus === 'Expired') {
    status = 'FAILED';
  } else {
    status = 'PENDING';
  }

  return {
    status,
    invoiceId: String(data.Data.InvoiceId),
    customerReference: data.Data.CustomerReference ?? null,
  };
}

export function getWebhookSecret(): string | undefined {
  return process.env.MYFATOORAH_WEBHOOK_SECRET;
}
