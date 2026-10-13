import { serverEnv } from '@/server/env';

type UWalletResponse<T> = {
  message?: number | string;
  data?: T;
  error?: unknown;
};

export type UWalletVoucherCreation = {
  transactionId?: string;
  code?: string;
};
export type UWalletVoucherActivation = {
  transactionId?: string;
  status?: string;
  receive?: number | string;
  batchId?: number;
};

export type UWalletTransaction = {
  id?: string;
  coin?: string;
  amount?: number | string;
  fee?: number;
  receive?: number | string;
  status?: string;
  side?: string;
  type?: string;
  data?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

async function request<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const env = serverEnv();
  if (!env.uwalletToken) {
    throw new Error('UWALLET_TOKEN is not configured');
  }

  const response = await fetch(`${env.uwalletBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: env.uwalletToken,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: UWalletResponse<T> | T;

  try {
    payload = JSON.parse(text) as UWalletResponse<T> | T;
  } catch {
    throw new Error(`uWallet returned invalid JSON (${response.status})`);
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object'
        ? JSON.stringify(payload).slice(0, 2000)
        : String(payload).slice(0, 2000);
    throw new Error(`uWallet request failed (${response.status}): ${detail}`);
  }

  return payload as T;
}

export async function createVoucher(input: {
  coin: string;
  amount: string;
}): Promise<UWalletVoucherCreation> {
  const payload = await request<UWalletVoucherCreation | UWalletResponse<UWalletVoucherCreation>>(
    '/v1/voucher',
    {
      method: 'POST',
      body: JSON.stringify({
        coin: input.coin,
        amount: input.amount,
      }),
    },
  );
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data &&
    typeof payload.data === 'object'
  ) {
    return payload.data as UWalletVoucherCreation;
  }
  return payload as UWalletVoucherCreation;
}

export async function activateVoucher(input: {
  coin: string;
  code: string;
}): Promise<UWalletVoucherActivation> {
  const payload = await request<UWalletVoucherActivation | UWalletResponse<UWalletVoucherActivation>>(
    '/v1/voucher/use',
    {
      method: 'POST',
      body: JSON.stringify({
        coin: input.coin,
        code: input.code,
      }),
    },
  );

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data &&
    typeof payload.data === 'object'
  ) {
    return payload.data as UWalletVoucherActivation;
  }

  return payload as UWalletVoucherActivation;
}

export async function getTransaction(
  transactionId: string,
): Promise<UWalletTransaction> {
  const payload = await request<UWalletTransaction[] | UWalletResponse<UWalletTransaction[]>>(
    `/v1/transaction?id=${encodeURIComponent(transactionId)}`,
    {
      method: 'GET',
    },
  );

  const inner = payload && typeof payload === 'object' && 'data' in payload
    ? payload.data
    : payload;

  // uWallet installations return either an array of transactions or an
  // object for a single id. Treat an unknown shape as an error; an empty
  // fabricated response would strand redeemed voucher deposits as pending.
  const transaction = Array.isArray(inner) ? inner[0] : inner;
  if (
    !transaction || typeof transaction !== 'object' ||
    Array.isArray(transaction) ||
    (typeof (transaction as UWalletTransaction).status !== 'string' &&
     typeof (transaction as UWalletTransaction).id !== 'string')
  ) {
    throw new Error('uWallet returned an invalid transaction structure');
  }
  return transaction as UWalletTransaction;
}


export type UWalletSwap = {
  coin?: string;
  percent?: number | string;
};
export type UWalletCoin = {
  coin?: string;
  symbol?: string;
  name?: string;
  precision?: number;
  swap?: UWalletSwap[];
  voucher?: { create?: boolean; use?: boolean };
};
export async function getCoins(): Promise<UWalletCoin[]> {
  const payload = await request<UWalletCoin[] | UWalletResponse<UWalletCoin[]>>(
    '/v1/coin',
    { method: 'GET' },
  );
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }
  return Array.isArray(payload) ? payload : [];
}

export type UWalletSendResult = {
  hash?: string;
};

export async function sendCoin(input: {
  coin: string;
  amount: string;
  receiver: string;
}): Promise<UWalletSendResult> {
  const payload = await request<UWalletSendResult | UWalletResponse<UWalletSendResult>>(
    '/v1/wallet/send',
    {
      method: 'POST',
      body: JSON.stringify({
        coin: input.coin,
        amount: input.amount,
        receiver: input.receiver,
      }),
    },
  );
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data &&
    typeof payload.data === 'object'
  ) {
    return payload.data as UWalletSendResult;
  }
  return payload as UWalletSendResult;
}

