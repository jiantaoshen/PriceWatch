export type ItemType = "Product" | "Subscription";

export type ItemListItem = {
  id: string;
  itemType: ItemType;
  name: string;
  currency: string;
  unit: string | null;
  targetUnitPrice: number | null;
  currentUnitPrice: number | null;
  previousUnitPrice: number | null;
  monthlyPrice: number | null;
  currentStores: string[];
  sourceCount: number;
  hasScrapingSources: boolean;
  checkIntervalMinutes: number | null;
  trackingEnabled: boolean;
  lastCheckedAt: string | null;
  lastSuccessfulPriceAt: string | null;
  lastPriceChangedAt: string | null;
  archivedAt: string | null;
};

export type ItemSourceDetail = {
  id: number;
  store: string;
  url: string | null;
  scrapingEnabled: boolean;
  defaultQuantity: number;
  note: string | null;
  archivedAt: string | null;
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
  currentStores: string[];
  previousPrice: number | null;
  previousQuantity: number | null;
  previousUnitPrice: number | null;
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
  stores: string[];
};

export type SourceOffer = {
  sourceId: number;
  store: string;
  url: string | null;
  note: string | null;
  scrapingEnabled: boolean;
  defaultQuantity: number;
  price: number | null;
  quantity: number | null;
  unitPrice: number | null;
  origin: "Scrape" | "Manual" | null;
  observedAt: string | null;
  hasPendingReview: boolean;
  isBest: boolean;
};

export type PendingReview = {
  id: number;
  itemId: string;
  itemName: string;
  sourceId: number;
  store: string;
  defaultQuantity: number;
  resultStatus: "Success" | "Suspicious" | "Failed";
  reviewStatus: string;
  scrapedPrice: number | null;
  scrapedQuantity: number | null;
  scrapedUnitPrice: number | null;
  currentUnitPrice: number | null;
  targetUnitPrice: number | null;
  lastKnownUnitPrice: number | null;
  hasLastKnownPrice: boolean;
  suspiciousReason: string | null;
  error: string | null;
  observedAt: string;
  createdAt: string;
  currency: string;
  unit: string | null;
};

export type ProductFilter =
  | "active"
  | "archived"
  | "below-target"
  | "drops"
  | "increases";
