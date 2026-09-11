/**
 * File: components/products/ProductArchiveBadge.tsx
 * Purpose:
 *   Shows a small Archived badge only when a product is outside active tracking.
 *
 * Main function:
 *   - ProductArchiveBadge({ archivedAt }): renders the archive state or nothing.
 *
 * Inputs:
 *   archived_at value from ProductConfig.
 *
 * Outputs:
 *   A compact visual badge; no state changes or persistence.
 */

import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";


export function ProductArchiveBadge({ archivedAt }: { archivedAt: string | null }) {
  if (archivedAt === null) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <Archive className="size-3" />
      Archived
    </Badge>
  );
}
