export type ItemType =
  | "Product"
  | "Subscription";

export type UpdateMode =
  | "Manual"
  | "Automatic"
  | "Hybrid";

export type ItemListItem = {
  id: string;
  itemType: ItemType;
  name: string;
  currency: string;
  unit: string | null;

  targetUnitPrice: number | null;
  currentUnitPrice: number | null;
  previousUnitPrice: number | null;

  currentStore: string | null;
  sourceCount: number;

  lastPurchasePrice: number | null;
  lastPurchaseDate: string | null;

  updateMode: UpdateMode;
  checkIntervalMinutes: number | null;
  trackingEnabled: boolean;

  lastCheckedAt: string | null;
  lastSuccessfulPriceAt: string | null;
  lastPriceChangedAt: string | null;

  archivedAt: string | null;
  belowTarget: boolean;
};

export type ItemSourceDetail = {
  id: number;
  store: string;
  url: string | null;
  scrapingEnabled: boolean;
  defaultQuantity: number;
  manualPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemDetail = {
  id: string;
  itemType: ItemType;
  name: string;
  currency: string;
  unit: string | null;

  targetPrice: number | null;
  comparisonQuantity: number;
  targetUnitPrice: number | null;

  currentPrice: number | null;
  currentQuantity: number | null;
  currentUnitPrice: number | null;
  currentSourceId: number | null;
  currentStore: string | null;

  previousPrice: number | null;
  previousQuantity: number | null;
  previousUnitPrice: number | null;
  previousSourceId: number | null;
  previousStore: string | null;

  lastPurchasePrice: number | null;
  lastPurchaseDate: string | null;

  updateMode: UpdateMode;
  checkIntervalMinutes: number | null;
  trackingEnabled: boolean;

  lastCheckedAt: string | null;
  lastSuccessfulPriceAt: string | null;
  lastPriceChangedAt: string | null;

  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;

  sources: ItemSourceDetail[];
};

export type PriceHistoryPoint = {
  recordedAt: string;
  unitPrice: number;
};

export type SourceOffer = {
  sourceId: number;
  store: string;
  url: string | null;
  note: string | null;
  scrapingEnabled: boolean;
  origin: string | null;
  price: number | null;
  quantity: number | null;
  unitPrice: number | null;
  observedAt: string | null;
  isCurrent: boolean;
};

export type PendingReview = {
  id: number;
  itemId: string;
  itemName: string;
  sourceId: number | null;
  store: string | null;
  resultStatus: string;
  reviewStatus: string;
  scrapedPrice: number | null;
  scrapedQuantity: number | null;
  scrapedUnitPrice: number | null;
  currentUnitPrice: number | null;
  targetUnitPrice: number | null;
  suspiciousReason: string | null;
  error: string | null;
  createdAt: string;

  // Recommended additions to ReviewsController output.
  // Optional so the page still works before that API patch.
  currency?: string;
  unit?: string | null;
};

export type ProductFilter =
  | "active"
  | "archived"
  | "below-target"
  | "needs-review"
  | "drops"
  | "increases";
