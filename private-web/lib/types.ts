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
  automaticSources: number;
  manualSources: number;
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
  automaticSourceCount: number;
  manualSourceCount: number;
  updateMode: "manual" | "automatic" | "hybrid";
  trackingEnabled: boolean;
  lastCheckedAt: string | null;
  lastPriceChangedAt: string | null;
  archivedAt: string | null;
  belowTarget: boolean;
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
