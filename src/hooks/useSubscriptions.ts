/**
 * File: hooks/useSubscriptions.ts
 * Purpose:
 *   Loads and refreshes the independent subscription collection.
 *
 * Main functions:
 *   - useSubscriptions(): fetch subscriptions on mount and expose refresh().
 *
 * Inputs:
 *   /api/subscriptions response through fetchSubscriptions().
 *
 * Outputs:
 *   subscriptions, loading, error and refresh for SubscriptionsPage.
 */

import { useCallback, useEffect, useState } from "react";

import { fetchSubscriptions } from "@/services/subscriptionApi";

import type { Subscription } from "@/services/subscriptionApi";


export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      setSubscriptions(await fetchSubscriptions());
    }
    catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Failed to load subscriptions.",
      );
    }
    finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return {
    subscriptions,
    loading,
    error,
    refresh,
  };
}
