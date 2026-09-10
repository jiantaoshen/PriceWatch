/**
 * File: components/products/ProductLifecycleBadge.tsx
 * Purpose:
 *   Displays the user's relationship to a saved product separately from scraper
 *   health/status. This avoids confusing "Owned" with scraper "Success".
 *
 * Main function:
 *   - ProductLifecycleBadge({ savedType }): renders Tracked/Owned/Subscription.
 *
 * Input:
 *   savedType from Product.saved_type.
 *
 * Output:
 *   A compact Badge component for product cards and detail headers.
 */

import { Badge } from "@/components/ui/badge";

import type { SavedType } from "@/services/productConfigApi";


interface ProductLifecycleBadgeProps {
  savedType: SavedType;
}


export function ProductLifecycleBadge({ savedType }: ProductLifecycleBadgeProps) {
  if (savedType === "owned") {
    return <Badge variant="secondary">Owned</Badge>;
  }

  if (savedType === "subscription") {
    return <Badge variant="secondary">Subscription</Badge>;
  }

  return <Badge variant="outline">Tracked</Badge>;
}
