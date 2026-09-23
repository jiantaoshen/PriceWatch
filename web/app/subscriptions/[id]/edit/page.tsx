"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { SubscriptionFormPage } from "@/components/subscription-form-page";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import type { ItemDetail } from "@/lib/types";

export default function EditSubscriptionPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, account, getAccessToken } = useAuth();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !account || !id) return;

    let cancelled = false;

    async function load() {
      try {
        const token = await getAccessToken();
        const result = await apiFetch<ItemDetail>(`/api/items/${id}`, token.accessToken);

        if (!cancelled) setItem(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, account, id, getAccessToken]);

  if (!ready) return null;

  if (!account) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Sign in to edit a subscription.
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!item) return null;

  return (
    <SubscriptionFormPage
      mode="edit"
      initialItem={item}
    />
  );
}