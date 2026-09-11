/**
 * File: App.tsx
 * Purpose:
 *   Composes top-level PriceWatch views. Product price tracking and subscription
 *   expense management are separate application domains/tabs.
 *
 * Main function:
 *   - App(): owns navigation and selected-product state and wires shared product data.
 *
 * Inputs:
 *   useAppData product/scraper state plus user navigation/selection actions.
 *
 * Outputs:
 *   Products, Subscriptions, AI, Scraper, Automation and Email screens.
 */

import { useState } from "react";

import { AiChat } from "@/components/ai/AiChat";
import { AutomationSettings } from "@/components/AutomationSettings";
import { EmailSettings } from "@/components/EmailSettings";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProductDetail } from "@/components/products/ProductDetail";
import { ProductList } from "@/components/products/ProductList";
import { ScraperDetail } from "@/components/scraper/ScraperDetail";
import { SubscriptionsPage } from "@/components/subscriptions/SubscriptionsPage";

import { useAppData } from "@/hooks/useAppData";

import type { AppView } from "@/types/app";


function App() {
  const data = useAppData();

  const [view, setView] = useState<AppView>("dashboard");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [aiProductIds, setAiProductIds] = useState<string[]>([]);

  const selectedProduct =
    data.latestData.data.find(product => product.product_id === selectedProductId) ?? null;

  function navigate(next: AppView) {
    setSelectedProductId(null);
    setAiProductIds([]);
    setView(next);
  }

  function handleAskAi(productId: string) {
    setSelectedProductId(null);
    setAiProductIds([productId]);
    setView("ai");
  }

  function handleBackFromProduct() {
    setSelectedProductId(null);
    setView("dashboard");
  }

  if (data.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {data.error}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        view={view}
        generatedAt={data.latestData.generated_at}
        latestRun={data.latestRun}
        onNavigate={navigate}
        onRefresh={data.refresh}
      />

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        {selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            history={data.historyData}
            currentPeriod={data.latestData.period}
            onBack={handleBackFromProduct}
            onRefresh={data.refresh}
            onAskAi={() => handleAskAi(selectedProduct.product_id)}
          />
        ) : (
          <>
            {view === "dashboard" && (
              <ProductList
                data={data.latestData}
                history={data.history}
                historyData={data.historyData}
                onSelectProduct={product => setSelectedProductId(product.product_id)}
                onRefresh={data.refresh}
              />
            )}

            {view === "subscriptions" && <SubscriptionsPage />}

            {view === "ai" && (
              <AiChat initialProductIds={aiProductIds} />
            )}

            {view === "scraper" && (
              <ScraperDetail run={data.latestRun} />
            )}

            {view === "automation" && (
              <AutomationSettings />
            )}

            {view === "email" && (
              <EmailSettings />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
