"use client";

import { ItemFormPage } from "@/components/product-form-page";
import { useAuth } from "@/components/auth-provider";

export default function NewItemPage() {
  const {
    ready,
    account,
  } = useAuth();

  if (!ready) {
    return null;
  }

  if (!account) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Sign in to add a product.
      </div>
    );
  }

  return (
    <ItemFormPage mode="create" />
  );
}
