export type RunSummary = {
  id: string;
  status: "running" | "success" | "partial" | "failed" | "abandoned";
  startedAt: string;
  finishedAt: string | null;
  totalItems: number;
  successful: number;
  suspicious: number;
  failed: number;
};

export type DashboardData = {
  coordinator: {
    isRunning: boolean;
    startedAt: string | null;
  };
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
  currentStores: string[];
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
  sourceId: number;
  store: string;
  resultStatus: "success" | "suspicious" | "failed";
  reviewStatus: "notRequired" | "pending" | "accepted" | "rejected" | "manualOverride";
  scrapedPrice: number | null;
  scrapedQuantity: number | null;
  scrapedUnitPrice: number | null;
  suspiciousReason: string | null;
  error: string | null;
  observedAt: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type ScheduleData = {
  exists: boolean;
  enabled: boolean;
  dayOfWeek: number;
  time: string;
  nextRunTime: string | null;
  lastRunTime: string | null;
  lastTaskResult: number | null;
};
