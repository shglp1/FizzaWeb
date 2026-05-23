import 'server-only';
import { PaymentGatewayError } from './types';

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
  customerMobile?: string;
  customerReference: string; // our Payment.id
  userId: string;
  purpose: string;
};

export type InvoiceResult = {
  invoiceId: string;
  invoiceUrl: string;
};

// ─── Regex for validating phone numbers ──────────────────────────────────────

const PHONE_REGEX = /^\+?\d{7,15}$/;

// ─── createInvoice ────────────────────────────────────────────────────────────

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResult> {
  // ── Upfront validation ────────────────────────────────────────────────────

  if (!params.amountSar || params.amountSar <= 0) {
    throw new PaymentGatewayError(
      `Invoice amount must be greater than zero (got ${params.amountSar}).`,
      'INVALID_PARAMS',
    );
  }

  const apiKey = process.env.MYFATOORAH_API_KEY;
  const baseUrl = process.env.MYFATOORAH_BASE_URL;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !apiKey.trim()) {
    throw new PaymentGatewayError(
      'MyFatoorah is not configured. Set MYFATOORAH_API_KEY.',
      'NOT_CONFIGURED',
    );
  }
  if (!baseUrl || !baseUrl.trim()) {
    throw new PaymentGatewayError(
      'MyFatoorah is not configured. Set MYFATOORAH_BASE_URL.',
      'NOT_CONFIGURED',
    );
  }
  if (!appUrl || !appUrl.trim()) {
    throw new PaymentGatewayError(
      'APP_URL is not configured. Cannot build callback URLs.',
      'NOT_CONFIGURED',
    );
  }

  // Prefer explicit env vars so webhook URL is never used as browser redirect
  const callbackUrl =
    process.env.MYFATOORAH_CALLBACK_URL?.trim() ||
    `${appUrl.trim()}/payment/callback`;
  const errorUrl =
    process.env.MYFATOORAH_ERROR_URL?.trim() ||
    `${appUrl.trim()}/payment/error`;

  // Email fallback — MyFatoorah requires a non-empty email
  const customerEmail = params.customerEmail?.trim() || 'noreply@example.com';

  // ── Build request payload ─────────────────────────────────────────────────

  const body: Record<string, unknown> = {
    NotificationOption: 'LNK',
    CustomerName: params.customerName || 'Customer',
    InvoiceValue: params.amountSar,
    CurrencyIso: 'SAR',
    DisplayCurrencyIso: 'SAR',
    CallBackUrl: callbackUrl,
    ErrorUrl: errorUrl,
    Language: 'AR',
    CustomerEmail: customerEmail,
    CustomerReference: params.customerReference,
  };

  // Include CustomerMobile only when it looks like a real phone number
  if (params.customerMobile && PHONE_REGEX.test(params.customerMobile.trim())) {
    body['CustomerMobile'] = params.customerMobile.trim();
  }

  // ── Call MyFatoorah ───────────────────────────────────────────────────────

  let response: Response;
  try {
    response = await fetch(`${baseUrl.trim()}/v2/SendPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // NOTE: Authorization header is intentionally not logged anywhere
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (fetchErr) {
    console.error('[myfatoorah] Network error reaching SendPayment', {
      baseUrl: baseUrl.trim(),
      purpose: params.purpose,
      amountSar: params.amountSar,
      userId: params.userId,
      error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
    });
    throw new PaymentGatewayError(
      'Could not reach payment gateway. Please try again.',
      'PAYMENT_GATEWAY_NETWORK_ERROR',
    );
  }

  // Always read the body — even on error it contains useful detail
  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  // ── Handle HTTP errors ────────────────────────────────────────────────────

  if (!response.ok) {
    const rb = responseBody as Record<string, unknown> | null;
    const providerMessage = (rb?.['Message'] as string | undefined) ??
      (rb?.['ValidationErrors'] as string | undefined) ??
      undefined;

    console.error('[myfatoorah] HTTP error from SendPayment', {
      baseUrl: baseUrl.trim(),
      httpStatus: response.status,
      providerMessage,
      purpose: params.purpose,
      amountSar: params.amountSar,
      userId: params.userId,
    });

    throw new PaymentGatewayError(
      'Payment gateway rejected the request.',
      'PAYMENT_GATEWAY_HTTP_ERROR',
      { providerStatus: response.status, providerMessage },
    );
  }

  // ── Handle application-level failure (IsSuccess = false) ─────────────────

  const data = responseBody as {
    IsSuccess?: boolean;
    Message?: string;
    Data?: { InvoiceId?: unknown; InvoiceURL?: string };
  } | null;

  if (!data?.IsSuccess) {
    const providerMessage = data?.Message ?? 'Unknown error';

    console.error('[myfatoorah] IsSuccess=false from SendPayment', {
      baseUrl: baseUrl.trim(),
      httpStatus: response.status,
      providerMessage,
      purpose: params.purpose,
      amountSar: params.amountSar,
      userId: params.userId,
    });

    throw new PaymentGatewayError(
      'Payment gateway declined the request.',
      'PAYMENT_GATEWAY_REJECTED',
      { providerStatus: response.status, providerMessage },
    );
  }

  // ── Validate returned invoice data ────────────────────────────────────────

  if (!data.Data?.InvoiceId || !data.Data?.InvoiceURL) {
    console.error('[myfatoorah] Missing InvoiceId or InvoiceURL in response', {
      baseUrl: baseUrl.trim(),
      httpStatus: response.status,
      purpose: params.purpose,
      amountSar: params.amountSar,
      userId: params.userId,
    });

    throw new PaymentGatewayError(
      'Payment gateway returned an incomplete response.',
      'PAYMENT_GATEWAY_INVALID_RESPONSE',
      { providerStatus: response.status },
    );
  }

  return {
    invoiceId: String(data.Data.InvoiceId),
    invoiceUrl: data.Data.InvoiceURL,
  };
}

// ─── getPaymentStatus ─────────────────────────────────────────────────────────

export type PaymentStatusResult = {
  status: 'PAID' | 'FAILED' | 'PENDING';
  invoiceId: string;
  customerReference: string | null;
};

export async function getPaymentStatus(
  key: string,
  keyType: 'PaymentId' | 'InvoiceId' = 'PaymentId',
): Promise<PaymentStatusResult> {
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
    body: JSON.stringify({ Key: key, KeyType: keyType }),
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
