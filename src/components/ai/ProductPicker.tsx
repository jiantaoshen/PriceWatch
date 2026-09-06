import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { ProductConfig } from "@/services/productConfigApi";

interface ProductPickerProps {
  products: ProductConfig[];
  selectedProductIds: string[];
  disabled?: boolean;
  onChange: (productIds: string[]) => void;
}

export function ProductPicker({
  products,
  selectedProductIds,
  disabled = false,
  onChange,
}: ProductPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedProducts = products.filter(product =>
    selectedProductIds.includes(product.id),
  );

  function toggleProduct(productId: string) {
    if (selectedProductIds.includes(productId)) {
      onChange(selectedProductIds.filter(id => id !== productId));
      return;
    }

    onChange([...selectedProductIds, productId]);
  }

  return (
    <>
      <div className="border-b px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">
            Considering
          </span>

          {selectedProducts.map(product => (
            <Button
              key={product.id}
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => toggleProduct(product.id)}
            >
              {product.name}
              <X data-icon="inline-end" />
            </Button>
          ))}

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            <Plus data-icon="inline-start" />
            Add product
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add products</DialogTitle>

            <DialogDescription>
              Select the PriceWatch products you want the advisor to analyze.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No products available.
              </p>
            ) : (
              products.map(product => {
                const selected = selectedProductIds.includes(product.id);

                return (
                  <Button
                    key={product.id}
                    type="button"
                    variant={selected ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start py-3 text-left"
                    onClick={() => toggleProduct(product.id)}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      {selected && <Check className="size-4" />}
                    </span>

                    <span className="truncate">
                      {product.name}
                    </span>
                  </Button>
                );
              })
            )}
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}