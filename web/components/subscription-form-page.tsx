"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { Label } from "@pricewatch/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import type { ItemDetail } from "@/lib/types";

type FormState = {
  name: string;
  monthlyPrice: string;
  currency: string;
};

function getSubscriptionSource(item?: ItemDetail) {
  if (!item) return undefined;
  return item.sources.find((source) => source.manualPrice !== null) ?? item.sources[0];
}

function toFormState(item?: ItemDetail): FormState {
  const source = getSubscriptionSource(item);

  return {
    name: item?.name ?? "",
    monthlyPrice: source?.manualPrice?.toString() ?? "",
    currency: item?.currency ?? "SEK",
  };
}

export function SubscriptionFormPage({
  mode,
  initialItem,
}: {
  mode: "create" | "edit";
  initialItem?: ItemDetail;
}) {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [form, setForm] = useState<FormState>(toFormState(initialItem));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!form.name.trim()) throw new Error("Subscription name is required.");

    const monthlyPrice = toNullableNumber(form.monthlyPrice);
    if (monthlyPrice === null || monthlyPrice < 0) {
      throw new Error("Monthly price is required and cannot be negative.");
    }

    if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) {
      throw new Error("Currency must be a 3-letter code, for example SEK.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      validate();

      const token = await getAccessToken();
      const monthlyPrice = toNullableNumber(form.monthlyPrice);

      const itemPayload = {
        itemType: "Subscription",
        name: form.name.trim(),
        currency: form.currency.trim().toUpperCase(),
        unit: "month",
        targetPrice: null,
        comparisonQuantity: 1,
        lastPurchasePrice: null,
        lastPurchaseDate: null,
        updateMode: "Manual",
        checkIntervalMinutes: null,
        trackingEnabled: true,
      };

      let itemId = initialItem?.id;

      if (mode === "create") {
        const created = await apiFetch<{ id: string }>("/api/items", token.accessToken, {
          method: "POST",
          body: JSON.stringify(itemPayload),
        });

        itemId = created.id;
      } else {
        await apiFetch<void>(`/api/items/${initialItem!.id}`, token.accessToken, {
          method: "PUT",
          body: JSON.stringify(itemPayload),
        });
      }

      if (!itemId) throw new Error("Item ID is missing.");

      // Current data model stores the subscription price in one hidden manual source.
      const sourcePayload = {
        store: form.name.trim(),
        url: null,
        scrapingEnabled: false,
        defaultQuantity: 1,
        manualPrice: monthlyPrice,
        note: null,
      };

      const source = getSubscriptionSource(initialItem);

      if (source) {
        await apiFetch<void>(`/api/items/${itemId}/sources/${source.id}`, token.accessToken, {
          method: "PUT",
          body: JSON.stringify(sourcePayload),
        });
      } else {
        await apiFetch<{ id: number }>(`/api/items/${itemId}/sources`, token.accessToken, {
          method: "POST",
          body: JSON.stringify(sourcePayload),
        });
      }

      router.push("/subscriptions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubscription() {
    if (!initialItem) return;

    setDeleting(true);
    setError(null);

    try {
      const token = await getAccessToken();

      await apiFetch<void>(`/api/items/${initialItem.id}`, token.accessToken, {
        method: "DELETE",
      });

      router.push("/subscriptions");
      router.refresh();
    } catch (err) {
      setDeleteOpen(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/15">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href="/subscriptions"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}
        >
          <ArrowLeft className="size-4" />
          Subscriptions
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "create" ? "Add subscription" : "Edit subscription"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Track the recurring monthly cost.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" full>
                <Input
                  value={form.name}
                  placeholder="Spotify Premium"
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </Field>

              <Field label="Monthly price">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.monthlyPrice}
                  onChange={(event) => updateForm("monthlyPrice", event.target.value)}
                />
              </Field>

              <Field label="Currency">
                <Input
                  value={form.currency}
                  maxLength={3}
                  placeholder="SEK"
                  onChange={(event) => updateForm("currency", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Link href="/subscriptions" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>

            <Button type="button" disabled={saving || deleting} onClick={() => void save()}>
              {saving ? "Saving…" : mode === "create" ? "Create subscription" : "Save changes"}
            </Button>
          </div>

          {mode === "edit" && (
            <div className="border-t pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div>
                  <h2 className="text-sm font-semibold">Delete subscription</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Permanently delete this subscription. This action cannot be undone.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving || deleting}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="pb-8" />
        </div>
      </main>

      {mode === "edit" && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {form.name || "subscription"}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this subscription. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>

              <AlertDialogAction
                disabled={deleting}
                className={buttonVariants({ variant: "destructive" })}
                onClick={(event) => {
                  event.preventDefault();
                  void deleteSubscription();
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
