import { randomUUID } from "node:crypto";

export type FinancePaymentState =
  | "PAYMENT_PENDING"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED";

export type FinanceEscrowState =
  | "FUNDS_PENDING"
  | "FUNDS_HELD"
  | "RELEASE_ELIGIBLE"
  | "PAYOUT_PENDING"
  | "PAYOUT_PROCESSING"
  | "PAYOUT_COMPLETED"
  | "PAYOUT_FAILED"
  | "REFUND_PENDING"
  | "REFUNDED";

export type FinancePayoutState =
  | "NOT_DUE"
  | "PENDING_RELEASE"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REVERSED";

export type FinanceLedgerEntry = {
  id: string;
  account: string;
  entryType: "CUSTOMER_PAYMENT" | "CARRIER_LIABILITY" | "PLATFORM_REVENUE" | "PROVIDER_FEE" | "TAX" | "REFUND" | "PAYOUT";
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  reference: string;
  idempotencyKey: string;
  createdAt: string;
};

export type FinancePayout = {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  provider: "flutterwave" | "simulation";
  providerTransferId?: string;
  status: "PENDING_RELEASE" | "PROCESSING" | "COMPLETED" | "FAILED" | "REVERSED";
  releaseReason?: string;
  createdAt: string;
  completedAt?: string;
};

type FinanceTimelineItem = {
  state: string;
  label: string;
  occurredAt: string;
};

export type FinanceWebhookEvent = {
  provider: "flutterwave";
  providerEventId: string;
  eventType: string;
  status: "Received" | "Processed" | "Ignored";
  receivedAt: string;
  processedAt?: string;
};

export type FinanceRefund = {
  id: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  provider: "flutterwave" | "simulation";
  providerRefundId?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  reason: string;
  createdAt: string;
};

type FinanceBookingState = {
  bookingId: string;
  grossAmount: number;
  currency: string;
  platformFee: number;
  providerFee: number;
  carrierPayable: number;
  paymentState: FinancePaymentState;
  escrowState: FinanceEscrowState;
  payoutState: FinancePayoutState;
  ledgerEntries: FinanceLedgerEntry[];
  payout?: FinancePayout;
  timeline: FinanceTimelineItem[];
};

export type FinanceState = {
  bookings: FinanceBookingState[];
  webhookEvents: FinanceWebhookEvent[];
  refunds: FinanceRefund[];
};

const state: FinanceState = { bookings: [], webhookEvents: [], refunds: [] };

function view(current: FinanceBookingState) {
  return { ...current, payout: current.payout ?? null };
}

function now() {
  return new Date().toISOString();
}

function bookingState(bookingId: string, defaults?: Partial<FinanceBookingState>) {
  let current = state.bookings.find((item) => item.bookingId === bookingId);
  if (!current) {
    current = {
      bookingId,
      grossAmount: defaults?.grossAmount ?? 0,
      currency: defaults?.currency ?? "UGX",
      platformFee: defaults?.platformFee ?? 0,
      providerFee: defaults?.providerFee ?? 0,
      carrierPayable: defaults?.carrierPayable ?? 0,
      paymentState: defaults?.paymentState ?? "PAYMENT_PENDING",
      escrowState: defaults?.escrowState ?? "FUNDS_PENDING",
      payoutState: defaults?.payoutState ?? "NOT_DUE",
      ledgerEntries: defaults?.ledgerEntries ?? [],
      payout: defaults?.payout,
      timeline: defaults?.timeline ?? [],
    };
    state.bookings.push(current);
  }
  return current;
}

function timeline(current: FinanceBookingState, nextState: string, label: string) {
  if (current.timeline.at(-1)?.state === nextState) return;
  current.timeline.push({ state: nextState, label, occurredAt: now() });
}

function entry(
  current: FinanceBookingState,
  input: Omit<FinanceLedgerEntry, "id" | "createdAt">,
) {
  if (current.ledgerEntries.some((item) => item.idempotencyKey === input.idempotencyKey)) return;
  current.ledgerEntries.push({ ...input, id: `ledger-${randomUUID()}`, createdAt: now() });
}

export function recordPayment(input: {
  bookingId: string;
  paymentId: string;
  grossAmount: number;
  currency: string;
  platformFee: number;
  providerFee: number;
  carrierPayable: number;
  reference: string;
}) {
  const current = bookingState(input.bookingId, {
    grossAmount: input.grossAmount,
    currency: input.currency,
    platformFee: input.platformFee,
    providerFee: input.providerFee,
    carrierPayable: input.carrierPayable,
  });
  if (current.ledgerEntries.some((item) => item.idempotencyKey === `payment:${input.paymentId}:collection`)) {
    return current;
  }
  current.grossAmount = input.grossAmount;
  current.currency = input.currency;
  current.platformFee = input.platformFee;
  current.providerFee = input.providerFee;
  current.carrierPayable = input.carrierPayable;
  current.paymentState = "PAYMENT_VERIFIED";
  current.escrowState = "FUNDS_HELD";
  current.payoutState = "PENDING_RELEASE";
  entry(current, {
    account: "flutterwave_collection",
    entryType: "CUSTOMER_PAYMENT",
    direction: "debit",
    amount: input.grossAmount,
    currency: input.currency,
    reference: input.reference,
    idempotencyKey: `payment:${input.paymentId}:collection`,
  });
  entry(current, {
    account: "carrier_payable",
    entryType: "CARRIER_LIABILITY",
    direction: "credit",
    amount: input.carrierPayable,
    currency: input.currency,
    reference: input.reference,
    idempotencyKey: `payment:${input.paymentId}:carrier`,
  });
  entry(current, {
    account: "truckshare_revenue",
    entryType: "PLATFORM_REVENUE",
    direction: "credit",
    amount: input.platformFee,
    currency: input.currency,
    reference: input.reference,
    idempotencyKey: `payment:${input.paymentId}:revenue`,
  });
  entry(current, {
    account: "provider_fee_expense",
    entryType: "PROVIDER_FEE",
    direction: "debit",
    amount: input.providerFee,
    currency: input.currency,
    reference: input.reference,
    idempotencyKey: `payment:${input.paymentId}:provider-fee`,
  });
  entry(current, {
    account: "flutterwave_collection",
    entryType: "PROVIDER_FEE",
    direction: "credit",
    amount: input.providerFee,
    currency: input.currency,
    reference: input.reference,
    idempotencyKey: `payment:${input.paymentId}:collection-fee`,
  });
  timeline(current, "PAYMENT_VERIFIED", "Payment verified");
  timeline(current, "FUNDS_HELD", "Carrier funds held pending delivery confirmation");
  return current;
}

export function ensureBookingFinance(input: {
  bookingId: string;
  grossAmount: number;
  currency: string;
  platformFee: number;
  providerFee: number;
  carrierPayable: number;
}) {
  return bookingState(input.bookingId, input);
}

export function markReleaseEligible(bookingId: string) {
  const current = bookingState(bookingId);
  if (current.paymentState !== "PAYMENT_VERIFIED" || current.escrowState !== "FUNDS_HELD") return current;
  current.escrowState = "RELEASE_ELIGIBLE";
  current.payoutState = "PENDING_RELEASE";
  timeline(current, "RELEASE_ELIGIBLE", "Delivery verified; payout is awaiting release approval");
  return current;
}

export function releasePayout(bookingId: string, reason: string) {
  const current = bookingState(bookingId);
  if (current.escrowState !== "RELEASE_ELIGIBLE" && current.escrowState !== "PAYOUT_PENDING") {
    return undefined;
  }
  const payout: FinancePayout = {
    id: `payout-${randomUUID()}`,
    bookingId,
    amount: current.carrierPayable,
    currency: current.currency,
    provider: "simulation",
    providerTransferId: `SIM-${randomUUID().slice(0, 10).toUpperCase()}`,
    status: "COMPLETED",
    releaseReason: reason,
    createdAt: now(),
    completedAt: now(),
  };
  current.payout = payout;
  current.escrowState = "PAYOUT_COMPLETED";
  current.payoutState = "COMPLETED";
  entry(current, {
    account: "carrier_payable",
    entryType: "PAYOUT",
    direction: "debit",
    amount: current.carrierPayable,
    currency: current.currency,
    reference: payout.providerTransferId ?? payout.id,
    idempotencyKey: `payout:${payout.id}:carrier`,
  });
  entry(current, {
    account: "flutterwave_collection",
    entryType: "PAYOUT",
    direction: "credit",
    amount: current.carrierPayable,
    currency: current.currency,
    reference: payout.providerTransferId ?? payout.id,
    idempotencyKey: `payout:${payout.id}:collection`,
  });
  timeline(current, "PAYOUT_COMPLETED", "Carrier payout completed in simulation mode");
  return view(current);
}

export function getBookingFinance(bookingId: string) {
  const current = state.bookings.find((item) => item.bookingId === bookingId);
  return current ? view(current) : undefined;
}

export function getFinanceOverview() {
  const overview = {
    currency: "UGX",
    totalCollected: 0,
    platformRevenue: 0,
    providerFees: 0,
    carrierFundsPendingRelease: 0,
    payoutsDue: 0,
    payoutsCompleted: 0,
    refundsPending: 0,
    reconciliationRequired: 0,
    bookingsFunded: 0,
  };
  for (const current of state.bookings) {
    overview.totalCollected += current.paymentState === "PAYMENT_VERIFIED" ? current.grossAmount : 0;
    overview.platformRevenue += current.platformFee;
    overview.providerFees += current.providerFee;
    if (["FUNDS_HELD", "RELEASE_ELIGIBLE"].includes(current.escrowState)) overview.carrierFundsPendingRelease += current.carrierPayable;
    if (current.payoutState === "PENDING_RELEASE") overview.payoutsDue += current.carrierPayable;
    if (current.payoutState === "COMPLETED") overview.payoutsCompleted += current.carrierPayable;
  }
  overview.refundsPending = state.refunds.filter((refund) => refund.status === "PENDING" || refund.status === "PROCESSING").length;
  return overview;
}

export function recordRefund(input: Omit<FinanceRefund, "createdAt">) {
  const existing = state.refunds.find((refund) => refund.id === input.id);
  if (existing) return existing;
  const refund = { ...input, createdAt: now() };
  state.refunds.push(refund);
  const current = bookingState(input.bookingId);
  current.paymentState = input.status === "COMPLETED" ? "REFUNDED" : "REFUND_PENDING";
  current.escrowState = input.status === "COMPLETED" ? "REFUNDED" : "REFUND_PENDING";
  timeline(current, current.escrowState, input.status === "COMPLETED" ? "Payment refunded" : "Refund requested");
  if (input.status === "COMPLETED") {
    entry(current, {
      account: "refund_expense",
      entryType: "REFUND",
      direction: "debit",
      amount: input.amount,
      currency: input.currency,
      reference: input.id,
      idempotencyKey: `refund:${input.id}:expense`,
    });
    entry(current, {
      account: "flutterwave_collection",
      entryType: "REFUND",
      direction: "credit",
      amount: input.amount,
      currency: input.currency,
      reference: input.id,
      idempotencyKey: `refund:${input.id}:collection`,
    });
  }
  return refund;
}

export function getRefund(refundId: string) {
  return state.refunds.find((refund) => refund.id === refundId);
}

export function updateRefund(refundId: string, status: FinanceRefund["status"], providerRefundId?: string) {
  const refund = getRefund(refundId);
  if (!refund) return undefined;
  refund.status = status;
  refund.providerRefundId = providerRefundId ?? refund.providerRefundId;
  return refund;
}

export function recordWebhookEvent(input: {
  providerEventId: string;
  eventType: string;
}) {
  const existing = state.webhookEvents.find(
    (item) => item.provider === "flutterwave" && item.providerEventId === input.providerEventId,
  );
  if (existing) return { event: existing, duplicate: true };
  const event: FinanceWebhookEvent = {
    provider: "flutterwave",
    providerEventId: input.providerEventId,
    eventType: input.eventType,
    status: "Received",
    receivedAt: now(),
  };
  state.webhookEvents.push(event);
  return { event, duplicate: false };
}

export function completeWebhookEvent(providerEventId: string, status: "Processed" | "Ignored") {
  const event = state.webhookEvents.find(
    (item) => item.provider === "flutterwave" && item.providerEventId === providerEventId,
  );
  if (event) {
    event.status = status;
    event.processedAt = now();
  }
  return event;
}

export function serializeFinanceState() {
  return JSON.stringify(state);
}

export function hydrateFinanceState(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<FinanceState>;
    if (Array.isArray(parsed.bookings)) state.bookings.splice(0, state.bookings.length, ...parsed.bookings);
    if (Array.isArray(parsed.webhookEvents)) state.webhookEvents.splice(0, state.webhookEvents.length, ...parsed.webhookEvents);
    if (Array.isArray(parsed.refunds)) state.refunds.splice(0, state.refunds.length, ...parsed.refunds);
  } catch {
    // Invalid persisted finance state should not prevent the app from starting.
  }
}