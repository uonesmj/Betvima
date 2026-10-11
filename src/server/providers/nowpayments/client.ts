import { serverEnv } from '@/server/env';

export type NowPaymentStatus =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired';

export interface NowPaymentCreateInput {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  ipnCallbackUrl: string;
  orderId: string;
  orderDescription: string;
}

export interface NowPaymentCreateResponse {
  payment_id: number | string;
  payment_status: NowPaymentStatus;
  pay_address?: string;
  payin_extra_id?: string | null;
  pay_amount?: number | string;
  pay_currency?: string;
  price_amount?: number | string;
  price_currency?: string;
  order_id?: string;
  order_description?: string;
  expiration_estimate_date?: string;
}

export interface NowPaymentIpnPayload {
  payment_id?: number | string;
  payment_status?: NowPaymentStatus;
  pay_address?: string;
  payin_extra_id?: string | null;
  pay_amount?: number | string;
  actually_paid?: number | string;
  pay_currency?: string;
  price_amount?: number | string;
  price_currency?: string;
  order_id?: string;
  order_description?: string;
  purchase_id?: string;
  outcome_amount?: number | string;
  outcome_currency?: string;
  fee?: number | string;
  created_at?: string;
  updated_at?: string;
}

function baseUrl(): string {
  return serverEnv().paymentProviderBaseUrl || 'https://api.nowpayments.io';
}

function payoutEmail(): string {
  const value = serverEnv().nowPaymentsPayoutEmail.trim();
  if (!value) throw new Error('NOWPAYMENTS_PAYOUT_EMAIL_NOT_CONFIGURED');
  return value;
}

function payoutPassword(): string {
  const value = serverEnv().nowPaymentsPayoutPassword;
  if (!value) throw new Error('NOWPAYMENTS_PAYOUT_PASSWORD_NOT_CONFIGURED');
  return value;
}

export async function authenticateMassPayouts(): Promise<{ token: string }> {
  const response = await request<{ token?: string; jwt?: string }>('/v1/auth', {
    method: 'POST',
    body: JSON.stringify({
      email: payoutEmail(),
      password: payoutPassword(),
    }),
  });
  const token = response.token ?? response.jwt;
  if (!token) throw new Error('NOWPAYMENTS_PAYOUT_AUTH_TOKEN_MISSING');
  return { token };
}

export async function getMassPayoutBalance(token: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/v1/balance', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function validateMassPayoutAddress(input: {
  token: string;
  address: string;
  currency: string;
}): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>('/v1/payout/validate-address', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
    body: JSON.stringify({
      address: input.address,
      currency: input.currency,
    }),
  });
}


export interface NowMassPayoutWithdrawal {
  address: string;
  currency: string;
  amount: number;
  ipn_callback_url?: string;
}

export interface NowMassPayoutCreateInput {
  withdrawals: NowMassPayoutWithdrawal[];
  ipnCallbackUrl?: string;
  executeAt?: string;
  interval?: 'ONETIME';
}

export interface NowMassPayoutCreateResponse {
  id?: string;
  batch_withdrawal_id?: string;
  status?: string;
  withdrawals?: unknown[];
  [key: string]: unknown;
}

export async function createMassPayout(
  token: string,
  input: NowMassPayoutCreateInput,
): Promise<NowMassPayoutCreateResponse> {
  const withdrawals = input.withdrawals.map((item) => ({
    address: item.address,
    currency: item.currency.toLowerCase(),
    amount: item.amount,
    ...(item.ipn_callback_url ? { ipn_callback_url: item.ipn_callback_url } : {}),
  }));

  return request<NowMassPayoutCreateResponse>('/v1/payout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(input.ipnCallbackUrl ? { ipn_callback_url: input.ipnCallbackUrl } : {}),
      ...(input.executeAt ? { execute_at: input.executeAt } : {}),
      ...(input.interval ? { interval: input.interval } : {}),
      withdrawals,
    }),
  });
}

export async function verifyMassPayout(
  token: string,
  payoutId: string,
  verificationCode: string,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/v1/payout/${encodeURIComponent(payoutId)}/verify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        verification_code: verificationCode,
      }),
    },
  );
}

export async function getMassPayoutStatus(
  token: string,
  payoutId: string,
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/v1/payout/${encodeURIComponent(payoutId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

function egressSecret(): string {
  const secret = process.env.NOVA_EGRESS_SECRET;
  if (!secret) throw new Error('NOWPAYMENTS_EGRESS_SECRET_NOT_CONFIGURED');
  return secret;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'x-nova-egress-secret': egressSecret(),
      'Content-Type': 'application/json',
      'User-Agent': 'NOVA-Sportsbook/1.0',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: unknown }).message)
        : `NOWPayments HTTP ${response.status}`;
    throw new Error(`NOWPAYMENTS_${response.status} ${path}: ${message}`);
  }

  return body as T;
}

export async function createPayment(input: NowPaymentCreateInput): Promise<NowPaymentCreateResponse> {
  return request<NowPaymentCreateResponse>('/v1/payment', {
    method: 'POST',
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency.toLowerCase(),
      pay_currency: input.payCurrency.toLowerCase(),
      ipn_callback_url: input.ipnCallbackUrl,
      order_id: input.orderId,
      order_description: input.orderDescription,
    }),
  });
}

export async function getPaymentStatus(paymentId: string | number): Promise<NowPaymentCreateResponse> {
  return request<NowPaymentCreateResponse>(`/v1/payment/${encodeURIComponent(String(paymentId))}`);
}

export async function getEstimate(input: {
  amount: number;
  currencyFrom: string;
  currencyTo: string;
}): Promise<{
  currency_from: string;
  currency_to: string;
  estimated_amount: number | string;
}> {
  const params = new URLSearchParams({
    amount: String(input.amount),
    currency_from: input.currencyFrom,
    currency_to: input.currencyTo,
  });
  return request(`/v1/estimate?${params.toString()}`);
}

export async function getMinAmount(input: {
  currencyFrom: string;
  currencyTo: string;
  fiatEquivalent?: string;
}): Promise<{
  currency_from: string;
  currency_to: string;
  min_amount: number;
  fiat_equivalent?: number;
}> {
  const params = new URLSearchParams({
    currency_from: input.currencyFrom,
    currency_to: input.currencyTo,
  });
  if (input.fiatEquivalent) params.set('fiat_equivalent', input.fiatEquivalent);
  return request(`/v1/min-amount?${params.toString()}`);
}

export async function getCurrencies(): Promise<{ currencies: string[] }> {
  return request<{ currencies: string[] }>('/v1/currencies');
}
