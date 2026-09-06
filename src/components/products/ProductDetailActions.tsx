import { useState } from "react";
import { Bot, Trash2 } from "lucide-react";

import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { deleteProductConfig } from "@/services/productConfigApi";

interface ProductDetailActionsProps {
  productId: string;
  productName: string;
  onUpdated?: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
  onAskAi: () => void;
}

export function ProductDetailActions({
  productId,
  productName,
  onUpdated,
  onDeleted,
  onAskAi,
}: ProductDetailActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    try {
      setError(null);
      setIsDeleting(true);

      await deleteProductConfig(productId);
      await onDeleted?.();

      setDeleteOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete product.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <ProductFormDialog
          mode="edit"
          productId={productId}
          onSaved={onUpdated}
        />

        <Button
          type="button"
          variant="outline"
          onClick={onAskAi}
        >
          <Bot data-icon="inline-start" />
          Ask AI
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setError(null);
            setDeleteOpen(true);
          }}
        >
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={nextOpen => {
          if (!nextOpen && isDeleting) return;

          setDeleteOpen(nextOpen);

          if (!nextOpen) {
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete product?</DialogTitle>

            <DialogDescription>
              This will remove{" "}
              <span className="font-medium text-foreground">
                {productName}
              </span>{" "}
              from your product configuration.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 data-icon="inline-start" />
              {isDeleting ? "Deleting..." : "Delete product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}