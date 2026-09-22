"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useParams,
} from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ItemFormPage } from "@/components/product-form-page";
import { SiteHeader } from "@/components/site-header";
import { ApiError, apiFetch } from "@/lib/api";
import type { ItemDetail } from "@/lib/types";

export default function EditItemPage() {
  const params =
    useParams<{ id: string }>();

  const {
    ready,
    account,
    getAccessToken,
  } = useAuth();

  const [item, setItem] =
    useState<ItemDetail | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!account) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const token =
          await getAccessToken();

        const result =
          await apiFetch<ItemDetail>(
            `/api/items/${params.id}`,
            token.accessToken
          );

        setItem(result);
      } catch (err) {
        if (
          err instanceof ApiError &&
          err.status === 403
        ) {
          setError(
            "No data available."
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : String(err)
          );
        }
      } finally {
        setLoading(false);
      }
    }

    load().catch(console.error);
  }, [
    ready,
    account,
    getAccessToken,
    params.id,
  ]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-muted/15">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">
          Loading product…
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-muted/15">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">
          Sign in to edit this product.
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-muted/15">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">
          {error ??
            "Product not found."}
        </div>
      </div>
    );
  }

  return (
    <ItemFormPage
      mode="edit"
      initialItem={item}
    />
  );
}
