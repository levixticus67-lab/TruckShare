import { timingSafeEqual } from "node:crypto";

const flutterwaveApiBase = "https://api.flutterwave.com/v3";

export type FlutterwaveMode = "flutterwave" | "simulation";

type FlutterwaveResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};

export type CheckoutRequest = {
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  phoneNumber: string;
  name: string;
  redirectUrl?: string;
  paymentOptions?: string;
  meta?: Record<string, string>;
};

export type CheckoutResult = {
  link?: string;
  txRef: string;
  providerTransactionId?: string;
  providerStatus: string;
};

export type VerifiedTransaction = {
  id: string;
  txRef: string;
  tx_ref?: string;
  status: string;
  amount: number;
  currency: string;
  flwRef?: string;
};

export type TransferRequest = {
  accountBank: string;
  accountNumber: string;
  amount: number;
  currency: string;
  beneficiaryName: string;
  narration: string;
  reference: string;
};

export type TransferResult = {
  id?: string;
  reference: string;
  status: string;
};

export type RefundResult = {
  id?: string;
  status: string;
  amount: number;
  currency: string;
};

export function flutterwaveMode(): FlutterwaveMode {
  return process.env.FLW_SECRET_KEY ? "flutterwave" : "simulation";
}

export function verifyFlutterwaveWebhook(signature: string | undefined) {
  const configuredHash = process.env.FLW_SECRET_HASH;
  if (!configuredHash || !signature) return false;
  const expected = Buffer.from(configuredHash);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

async function request<T>(path: string, init: RequestInit) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is required for live Flutterwave operations.");
  }
  const response = await fetch(`${flutterwaveApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json() as FlutterwaveResponse<T>;
  if (!response.ok || body.status !== "success") {
    throw new Error(body.message || `Flutterwave request failed with status ${response.status}.`);
  }
  return body.data as T;
}

export async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  if (flutterwaveMode() === "simulation") {
    return {
      txRef: input.txRef,
      providerStatus: "SIMULATION_PENDING",
    };
  }
  const data = await request<{ link?: string; id?: number; tx_ref?: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      payment_options: input.paymentOptions,
      customer: {
        email: input.email,
        phonenumber: input.phoneNumber,
        name: input.name,
      },
      meta: input.meta,
    }),
  });
  return {
    link: data.link,
    txRef: data.tx_ref || input.txRef,
    providerTransactionId: data.id ? String(data.id) : undefined,
    providerStatus: "PENDING",
  };
}

export async function verifyTransaction(transactionId: string): Promise<VerifiedTransaction> {
  return request<VerifiedTransaction>(`/transactions/${encodeURIComponent(transactionId)}/verify`, { method: "GET" });
}

export async function createTransfer(input: TransferRequest): Promise<TransferResult> {
  const data = await request<{ id?: number; reference?: string; status?: string }>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount: input.amount,
      currency: input.currency,
      beneficiary_name: input.beneficiaryName,
      narration: input.narration,
      reference: input.reference,
    }),
  });
  return {
    id: data.id ? String(data.id) : undefined,
    reference: data.reference || input.reference,
    status: data.status || "PENDING",
  };
}

export async function createRefund(transactionId: string, amount?: number): Promise<RefundResult> {
  const data = await request<{ id?: number; status?: string; amount?: number; currency?: string }>(
    `/transactions/${encodeURIComponent(transactionId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify(amount === undefined ? {} : { amount }),
    },
  );
  return {
    id: data.id ? String(data.id) : undefined,
    status: data.status || "PENDING",
    amount: data.amount || amount || 0,
    currency: data.currency || "UGX",
  };
}