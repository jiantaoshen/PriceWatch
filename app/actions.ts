"use server";
// HTML form handlers: validate writes, refresh pages, and return to the UI.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  saveItem,
  archiveItem,
  restoreItem,
  addSource,
  archiveSource,
  restoreSource,
  setSourceScraping,
} from "../lib/write-items";
import { excludeSuspiciousPrice } from "../lib/price-exclusions";
import { addManualPrice } from "../lib/write-prices";

export async function saveItemAction(form: FormData) {
  const id = saveItem(form, String(form.get("id") || "") || undefined);
  revalidatePath("/");
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function archiveItemAction(form: FormData) {
  archiveItem(String(form.get("id")));
  revalidatePath("/");
  redirect("/");
}

export async function addSourceAction(form: FormData) {
  const id = addSource(form);
  revalidatePath(`/items/${id}`);
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function archiveSourceAction(form: FormData) {
  const id = String(form.get("item_id"));
  archiveSource(Number(form.get("source_id")), id);
  revalidatePath(`/items/${id}`);
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function addPriceAction(form: FormData) {
  const id = addManualPrice(form);
  revalidatePath(`/items/${id}`);
  revalidatePath("/");
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function restoreItemAction(form: FormData) {
  restoreItem(String(form.get("id")));
  revalidatePath("/");
  redirect("/");
}

export async function restoreSourceAction(form: FormData) {
  const id = String(form.get("item_id") || "");
  restoreSource(Number(form.get("source_id")), id);
  revalidatePath(`/items/${id}`);
  revalidatePath("/");
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function excludeSuspiciousPriceAction(form: FormData) {
  const id = String(form.get("item_id") || "");
  excludeSuspiciousPrice(id, Number(form.get("price_id")));
  revalidatePath(`/items/${id}`);
  revalidatePath("/");
  redirect(`/items/${encodeURIComponent(id)}`);
}

export async function setSourceScrapingAction(form: FormData) {
  const id = String(form.get("item_id") || "");
  const enabled = form.get("enabled") === "1";
  setSourceScraping(Number(form.get("source_id")), id, enabled);
  revalidatePath(`/items/${id}`);
  redirect(`/items/${encodeURIComponent(id)}`);
}
