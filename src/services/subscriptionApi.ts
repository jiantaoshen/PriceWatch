/**
 * File: services/subscriptionApi.ts
 * Purpose:
 *   Typed frontend client for subscriptions, which are a separate domain from
 *   scraper products and are stored through /api/subscriptions.
 *
 * Main functions:
 *   - fetchSubscriptions(): load all active/cancelled subscriptions.
 *   - createSubscription(input): add a recurring expense.
 *   - updateSubscription(id, input): edit a recurring expense.
 *   - activateSubscription(id): mark a subscription active.
 *   - cancelSubscription(id): mark a subscription cancelled.
 *   - deleteSubscription(id): permanently remove a subscription.
 *
 * Inputs:
 *   SubscriptionInput payloads from the Subscriptions UI.
 *
 * Outputs:
 *   Current Subscription records from the ASP.NET API.
 */

import { apiJson, jsonRequest } from "@/services/api";


const SUBSCRIPTIONS_URL = "/api/subscriptions";


export type BillingInterval = "weekly" | "monthly" | "quarterly" | "yearly";


export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_interval: BillingInterval;
  next_billing_date: string | null;
  is_active: boolean;
  note: string | null;
}


export interface SubscriptionInput {
  name: string;
  price: number;
  currency: string;
  billing_interval: BillingInterval;
  next_billing_date: string | null;
  note: string | null;
}


export async function fetchSubscriptions(): Promise<Subscription[]> {
  const subscriptions = await apiJson<Subscription[]>(SUBSCRIPTIONS_URL, {
    cache: "no-store",
  });

  if (!Array.isArray(subscriptions)) {
    throw new Error("Invalid subscriptions response.");
  }

  return subscriptions;
}


export async function createSubscription(
  input: SubscriptionInput,
): Promise<Subscription> {
  return await apiJson<Subscription>(
    SUBSCRIPTIONS_URL,
    jsonRequest("POST", input),
  );
}


export async function updateSubscription(
  id: string,
  input: SubscriptionInput,
): Promise<Subscription> {
  return await apiJson<Subscription>(
    `${SUBSCRIPTIONS_URL}/${encodeURIComponent(id)}`,
    jsonRequest("PUT", input),
  );
}


export async function activateSubscription(id: string): Promise<Subscription> {
  return await apiJson<Subscription>(
    `${SUBSCRIPTIONS_URL}/${encodeURIComponent(id)}/activate`,
    jsonRequest("POST", {}),
  );
}


export async function cancelSubscription(id: string): Promise<Subscription> {
  return await apiJson<Subscription>(
    `${SUBSCRIPTIONS_URL}/${encodeURIComponent(id)}/cancel`,
    jsonRequest("POST", {}),
  );
}


export async function deleteSubscription(id: string): Promise<void> {
  await apiJson<void>(
    `${SUBSCRIPTIONS_URL}/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
