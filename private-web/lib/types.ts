export type RunSummary = {
  id: string;
  status: "running" | "success" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  totalItems: number;
  successful: number;
  suspicious: number;
  failed: number;
};

export type CoordinatorStatus = {
  running: boolean;
  currentRunId: string | null;
  startedAt: string | null;
  lastError: string | null;
};

export type DashboardData = {
  coordinator: CoordinatorStatus;
  activeItems: number;
  scrapingSources: number;
  pendingReviews: number;
  lastRun: RunSummary | null;
};

export type PrivateItem = {
  id: string;
  itemType: "product" | "subscription";
  name: string;
  currency: string;
  unit: string | null;
  targetUnitPrice: number | null;
  currentUnitPrice: number | null;
  previousUnitPrice: number | null;
  currentStore: string | null;
  sourceCount: number;
  hasScrapingSources: boolean;
  checkIntervalMinutes: number | null;
  trackingEnabled: boolean;
  lastCheckedAt: string | null;
  lastPriceChangedAt: string | null;
  archivedAt: string | null;
};

export type RunResult = {
  id: number;
  itemId: string;
  itemName: string;
  sourceId: number | null;
  store: string | null;
  resultStatus: "success" | "suspicious" | "failed";
  reviewStatus: "notRequired" | "pending" | "accepted" | "rejected" | "manualOverride";
  scrapedPrice: number | null;
  scrapedQuantity: number | null;
  scrapedUnitPrice: number | null;
  suspiciousReason: string | null;
  error: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ScheduleStatus = {
  taskExists: boolean;
  enabled: boolean;
  day: string;
  time: string;
  runIfMissed: boolean;
};
