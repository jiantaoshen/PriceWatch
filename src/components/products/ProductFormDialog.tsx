/**
 * File: components/products/ProductFormDialog.tsx
 * Purpose:
 *   Opens the existing scraper-oriented add/edit product form. Lifecycle fields
 *   are intentionally excluded so editing sources or targets cannot overwrite
 *   ownership/subscription information.
 *
 * Main functions:
 *   - ProductFormDialog(props): controls create/edit dialog state.
 *   - handleOpen(): loads one ProductConfig when editing.
 *   - handleSubmit(): creates or updates scraper configuration.
 *
 * Inputs:
 *   mode, optional productId, and optional onSaved callback.
 *
 * Outputs:
 *   Created/updated ProductConfig through the product-config API and callback.
 */

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { ProductForm } from "@/components/products/ProductForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useProductForm } from "@/hooks/useProductForm";
import {
  createProductConfig,
  fetchProductConfig,
  updateProductConfig,
} from "@/services/productConfigApi";

import type { ProductConfig } from "@/services/productConfigApi";


type ProductFormMode = "create" | "edit";

interface ProductFormDialogProps {
  mode: ProductFormMode;
  productId?: string;
  onSaved?: (product: ProductConfig) => void | Promise<void>;
}


export function ProductFormDialog({
  mode,
  productId,
  onSaved,
}: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productForm = useProductForm();
  const isEditing = mode === "edit";

  const title = isEditing ? "Edit product" : "Add product";
  const description = isEditing
    ? "Update product settings, comparison quantity, targets and stores."
    : "Add a product and configure its comparison quantity, targets and store sources.";


  function close() {
    if (saving) return;

    setOpen(false);
    setError(null);
    productForm.reset();
  }


  async function handleOpen() {
    if (loading || saving) return;

    setError(null);
    productForm.reset();

    if (!isEditing) {
      setOpen(true);
      return;
    }

    if (!productId) {
      setError("Product ID is required.");
      setOpen(true);
      return;
    }

    try {
      setLoading(true);

      const product = await fetchProductConfig(productId);
      productForm.loadProduct(product);
      setOpen(true);
    }
    catch (error) {
      setError(getError(error, "Failed to load product."));
      setOpen(true);
    }
    finally {
      setLoading(false);
    }
  }


  async function handleSubmit() {
    if (saving) return;

    try {
      setError(null);
      setSaving(true);

      const input = productForm.buildInput();
      const product = isEditing
        ? await updateProductConfig(productId!, input)
        : await createProductConfig(input);

      await onSaved?.(product);

      setOpen(false);
      productForm.reset();
    }
    catch (error) {
      setError(
        getError(
          error,
          isEditing
            ? "Failed to update product."
            : "Failed to create product.",
        ),
      );
    }
    finally {
      setSaving(false);
    }
  }


  return (
    <>
      <Button
        type="button"
        variant={isEditing ? "outline" : "default"}
        disabled={loading}
        onClick={() => void handleOpen()}
      >
        {isEditing
          ? <Pencil data-icon="inline-start" />
          : <Plus data-icon="inline-start" />}

        {loading ? "Loading..." : title}
      </Button>


      <Dialog
        open={open}
        onOpenChange={nextOpen => {
          if (nextOpen) setOpen(true);
          else close();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <ProductForm
            form={productForm.form}
            isEditing={isEditing}
            isSaving={saving}
            onFieldChange={productForm.setField}
            onSourceChange={productForm.updateSource}
            onAddSource={productForm.addSource}
            onRemoveSource={productForm.removeSource}
            onSubmit={handleSubmit}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}


function getError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}