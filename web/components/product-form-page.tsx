"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription } from "@pricewatch/ui/alert";
import { Button, buttonVariants } from "@pricewatch/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@pricewatch/ui/card";
import { Input } from "@pricewatch/ui/input";
import { Label } from "@pricewatch/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import type { ItemDetail, UpdateMode } from "@/lib/types";

type SourceDraft = {
  id?: number;
  key: string;
  store: string;
  url: string;
  kind: "automatic" | "manual";
  defaultQuantity: string;
  manualPrice: string;
  note: string;
};

type FormState = {
  name: string;
  currency: string;
  unit: string;
  targetPrice: string;
  comparisonQuantity: string;
  updateMode: UpdateMode;
  checkIntervalMinutes: string;
  trackingEnabled: boolean;
};

function createEmptySource(): SourceDraft {
  return {
    key: crypto.randomUUID(),
    store: "",
    url: "",
    kind: "automatic",
    defaultQuantity: "1",
    manualPrice: "",
    note: "",
  };
}

function toFormState(item?: ItemDetail): FormState {
  return {
    name: item?.name ?? "",
    currency: item?.currency ?? "SEK",
    unit: item?.unit ?? "pcs",
    targetPrice: item?.targetPrice?.toString() ?? "",
    comparisonQuantity: item?.comparisonQuantity?.toString() ?? "1",
    updateMode: item?.updateMode ?? "Automatic",
    checkIntervalMinutes: item?.checkIntervalMinutes?.toString() ?? "",
    trackingEnabled: item?.trackingEnabled ?? true,
  };
}

function toSourceDrafts(item?: ItemDetail): SourceDraft[] {
  if (!item) return [createEmptySource()];

  return item.sources.map((source) => ({
    id: source.id,
    key: String(source.id),
    store: source.store,
    url: source.url ?? "",
    kind: !source.scrapingEnabled && source.manualPrice !== null ? "manual" : "automatic",
    defaultQuantity: source.defaultQuantity.toString(),
    manualPrice: source.manualPrice?.toString() ?? "",
    note: source.note ?? "",
  }));
}

export function ItemFormPage({
  mode,
  initialItem,
}: {
  mode: "create" | "edit";
  initialItem?: ItemDetail;
}) {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [form, setForm] = useState<FormState>(toFormState(initialItem));
  const [sources, setSources] = useState<SourceDraft[]>(toSourceDrafts(initialItem));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUnitPreview = useMemo(() => {
    const price = toNullableNumber(form.targetPrice);
    const quantity = Number(form.comparisonQuantity);

    if (price === null || !Number.isFinite(quantity) || quantity <= 0) return null;
    return price / quantity;
  }, [form.targetPrice, form.comparisonQuantity]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSource(key: string, update: Partial<SourceDraft>) {
    setSources((current) =>
      current.map((source) => (source.key === key ? { ...source, ...update } : source))
    );
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      validate();

      const token = await getAccessToken();

      const itemPayload = {
        itemType: "Product",
        name: form.name.trim(),
        currency: form.currency.trim().toUpperCase(),
        unit: emptyToNull(form.unit),
        targetPrice: toNullableNumber(form.targetPrice),
        comparisonQuantity: Number(form.comparisonQuantity),
        updateMode: form.updateMode,
        checkIntervalMinutes: toNullableInteger(form.checkIntervalMinutes),
        trackingEnabled: form.trackingEnabled,
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

      for (const source of sources) {
        if (!source.store.trim()) continue;

        const payload = {
          store: source.store.trim(),
          url: emptyToNull(source.url),
          scrapingEnabled: source.kind === "automatic",
          defaultQuantity: Number(source.defaultQuantity),
          manualPrice: source.kind === "manual" ? toNullableNumber(source.manualPrice) : null,
          note: emptyToNull(source.note),
        };

        if (source.id) {
          await apiFetch<void>(`/api/items/${itemId}/sources/${source.id}`, token.accessToken, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
        } else {
          await apiFetch<{ id: number }>(`/api/items/${itemId}/sources`, token.accessToken, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }
      }

      router.push(`/items/${itemId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function validate() {
    if (!form.name.trim()) throw new Error("Product name is required.");

    const comparisonQuantity = Number(form.comparisonQuantity);
    if (!Number.isFinite(comparisonQuantity) || comparisonQuantity <= 0) {
      throw new Error("Comparison quantity must be greater than zero.");
    }

    for (const source of sources) {
      if (!source.store.trim()) continue;

      const quantity = Number(source.defaultQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Source "${source.store}" needs a quantity greater than zero.`);
      }

      if (source.kind === "manual" && toNullableNumber(source.manualPrice) === null) {
        throw new Error(`Manual source "${source.store}" needs a manual price.`);
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted/15">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={initialItem ? `/items/${initialItem.id}` : "/"}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}
        >
          <ArrowLeft className="size-4" />
          {initialItem ? "Product" : "Products"}
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "create" ? "Add product" : "Edit product"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Raw package price and quantity stay in the data model; the website compares normalized unit prices.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" full>
                <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
              </Field>

              <Field label="Update mode">
                <Select value={form.updateMode} onValueChange={(value) => updateForm("updateMode", value as UpdateMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Automatic">Automatic</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Currency">
                <Input
                  value={form.currency}
                  maxLength={3}
                  onChange={(event) => updateForm("currency", event.target.value)}
                />
              </Field>

              <Field label="Unit">
                <Input
                  value={form.unit}
                  placeholder="pcs, ml, kg…"
                  onChange={(event) => updateForm("unit", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Target</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Target price">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.targetPrice}
                  onChange={(event) => updateForm("targetPrice", event.target.value)}
                />
              </Field>

              <Field label="Comparison quantity">
                <Input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.comparisonQuantity}
                  onChange={(event) => updateForm("comparisonQuantity", event.target.value)}
                />
              </Field>

              <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Calculated target unit price
                </div>

                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {targetUnitPreview === null
                    ? "—"
                    : `${targetUnitPreview.toFixed(2)} ${form.currency}${form.unit ? `/${form.unit}` : ""}`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
                <div>
                  <Label>Tracking enabled</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Archived products are automatically disabled.
                  </p>
                </div>

                <Switch
                  checked={form.trackingEnabled}
                  onCheckedChange={(value) => updateForm("trackingEnabled", value)}
                />
              </div>

              <Field label="Check interval (minutes)">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Optional"
                  value={form.checkIntervalMinutes}
                  onChange={(event) => updateForm("checkIntervalMinutes", event.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Sources</CardTitle>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSources((current) => [...current, createEmptySource()])}
                >
                  <Plus className="size-4" />
                  Add source
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {sources.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  No sources yet.
                </div>
              ) : (
                sources.map((source, index) => (
                  <div key={source.key} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-medium">Source {index + 1}</h3>

                      {!source.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setSources((current) => current.filter((item) => item.key !== source.key))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>

                    <Separator className="my-4" />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Store">
                        <Input
                          value={source.store}
                          onChange={(event) => updateSource(source.key, { store: event.target.value })}
                        />
                      </Field>

                      <Field label="Price source">
                        <Select
                          value={source.kind}
                          onValueChange={(value) =>
                            updateSource(source.key, {
                              kind: value as "automatic" | "manual",
                              manualPrice: value === "automatic" ? "" : source.manualPrice,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="automatic">Automatic</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="URL" full>
                        <Input
                          value={source.url}
                          placeholder="https://..."
                          onChange={(event) => updateSource(source.key, { url: event.target.value })}
                        />
                      </Field>

                      <Field label="Quantity">
                        <Input
                          type="number"
                          min="0.000001"
                          step="any"
                          value={source.defaultQuantity}
                          onChange={(event) =>
                            updateSource(source.key, { defaultQuantity: event.target.value })
                          }
                        />
                      </Field>

                      {source.kind === "manual" && (
                        <Field label="Manual price">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={source.manualPrice}
                            onChange={(event) =>
                              updateSource(source.key, { manualPrice: event.target.value })
                            }
                          />
                        </Field>
                      )}

                      <Field label="Note" full>
                        <Textarea
                          value={source.note}
                          onChange={(event) => updateSource(source.key, { note: event.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2 pb-8">
            <Link
              href={initialItem ? `/items/${initialItem.id}` : "/"}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </Link>

            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
            </Button>
          </div>
        </div>
      </main>
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

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function toNullableInteger(value: string) {
  const number = toNullableNumber(value);
  return number === null ? null : Math.trunc(number);
}
