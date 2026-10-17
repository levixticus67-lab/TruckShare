const pesapalApiBase = "https://pay.pesapal.com/v3/api";

export type PesapalMode = "pesapal" | "simulation";

type PesapalEnvelope = {
  status?: string | number;
  message?: string;
  error?: null | string | { message?: string; code?: string };
};

type PesapalTokenResponse = PesapalEnvelope & {
  token?: string;
  expiryDate?: string;
};

export type CheckoutRequest = {
  merchantReference: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
  notificationId: string;
  email?: string;
  phoneNumber?: string;
  countryCode: string;
  firstName?: string;
  lastName?: string;
};

export type CheckoutResult = {
  redirectUrl?: string;
  orderTrackingId?: string;
  merchantReference: string;
  providerStatus: string;
};

export type PesapalTransactionStatus = PesapalEnvelope & {
  order_tracking_id?: string;
  merchant_reference?: string;
  amount?: number | string;
  currency?: string;
  payment_method?: string;
  payment_account?: string;
  confirmation_code?: string;
  payment_status_description?: string;
  status_code?: number | string;
};

export type PesapalRefundResult = {
  id?: string;
  status: "PROCESSING";
  message?: string;
};

let cachedToken: string | undefined;
let cachedTokenExpiresAt = 0;
let tokenRequest: Promise<string> | undefined;

export function pesapalMode(): PesapalMode {
  // Do not send live credentials to Pesapal from development builds.
  return process.env.NODE_ENV === "production" ? "pesapal" : "simulation";
}

export function hasPesapalConfiguration() {
  return Boolean(
    process.env.PESAPAL_CONSUMER_KEY?.trim() &&
    process.env.PESAPAL_CONSUMER_SECRET?.trim() &&
    process.env.PESAPAL_IPN_ID?.trim(),
  );
}

function requiredCredentials() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim();
  if (!consumerKey || !consumerSecret) {
    throw new Error("PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET are required for live Pesapal operations.");
  }
  return { consumerKey, consumerSecret };
}

function responseError(body: PesapalEnvelope, fallback: string) {
  if (typeof body.error === "string") return body.error;
  if (body.error && typeof body.error === "object" && body.error.message) return body.error.message;
  return body.message || fallback;
}

async function parseResponse<T extends PesapalEnvelope>(response: Response, fallback: string): Promise<T> {
  let body: T;
  try {
    body = await response.json() as T;
  } catch {
    throw new Error("Pesapal returned an invalid JSON response.");
  }
  if (!response.ok || (body.status !== undefined && String(body.status) !== "200") || body.error) {
    throw new Error(responseError(body, `${fallback} (HTTP ${response.status}).`));
  }
  return body;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const { consumerKey, consumerSecret } = requiredCredentials();
    const response = await fetch(`${pesapalApiBase}/Auth/RequestToken`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
    });
    const body = await parseResponse<PesapalTokenResponse>(response, "Pesapal authentication failed.");
    if (!body.token) throw new Error("Pesapal authentication response did not include an access token.");
    cachedToken = body.token;
    const expiryDate = body.expiryDate ? Date.parse(body.expiryDate) : Number.NaN;
    cachedTokenExpiresAt = Number.isFinite(expiryDate)
      ? Math.max(Date.now() + 1_000, expiryDate - 30_000)
      : Date.now() + 4 * 60_000;
    return body.token;
  })().finally(() => {
    tokenRequest = undefined;
  });

  return tokenRequest;
}

async function request<T extends PesapalEnvelope>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${pesapalApiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return parseResponse<T>(response, "Pesapal request failed.");
}

export async function createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
  if (pesapalMode() === "simulation") {
    return { merchantReference: input.merchantReference, providerStatus: "SIMULATION_PENDING" };
  }
  if (!process.env.PESAPAL_IPN_ID?.trim()) {
    throw new Error("PESAPAL_IPN_ID is required for live Pesapal checkout.");
  }

  const body = await request<PesapalEnvelope & {
    order_tracking_id?: string;
    merchant_reference?: string;
    redirect_url?: string;
  }>("/Transactions/SubmitOrderRequest", {
    method: "POST",
    body: JSON.stringify({
      id: input.merchantReference,
      currency: input.currency,
      amount: input.amount,
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      notification_id: process.env.PESAPAL_IPN_ID.trim(),
      redirect_mode: "TOP_WINDOW",
      billing_address: {
        email_address: input.email || undefined,
        phone_number: input.phoneNumber || undefined,
        country_code: input.countryCode,
        first_name: input.firstName || undefined,
        last_name: input.lastName || undefined,
      },
    }),
  });
  if (!body.order_tracking_id || !body.redirect_url) {
    throw new Error("Pesapal did not return an order tracking ID and checkout URL.");
  }
  return {
    orderTrackingId: body.order_tracking_id,
    merchantReference: body.merchant_reference || input.merchantReference,
    redirectUrl: body.redirect_url,
    providerStatus: "PENDING",
  };
}

export async function verifyTransaction(orderTrackingId: string): Promise<PesapalTransactionStatus> {
  return request<PesapalTransactionStatus>(
    `/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { method: "GET" },
  );
}

export async function createRefund(
  confirmationCode: string,
  amount: number,
  username: string,
  reason: string,
): Promise<PesapalRefundResult> {
  const body = await request<PesapalEnvelope>("/Transactions/RefundRequest", {
    method: "POST",
    body: JSON.stringify({
      confirmation_code: confirmationCode,
      amount,
      username,
      remarks: reason,
    }),
  });
  return { status: "PROCESSING", message: body.message };
}
