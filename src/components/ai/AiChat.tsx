/**
 * File: components/ai/AiChat.tsx
 * Purpose:
 *   Provides a compact React test surface for the frozen V10.3 AI Advisor flow.
 *   Despite the legacy component name, this is not free-form chat: one click sends
 *   one Product Watch plus optional user context and displays the structured result.
 *
 * Main functions:
 *   - AiChat(): loads products/advisors/local AI health and runs recommendations.
 *   - LevelSelect(): shared low/medium/high/unknown context selector.
 *
 * Inputs:
 *   Optional initial product ID from Product Detail and user-entered context.
 *
 * Outputs:
 *   BUY/WAIT/NEUTRAL, confidence, selected drivers, Python factual explanation,
 *   latency/token metadata and visible provider/model status.
 */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  getAdvisors,
  getAiHealth,
  getRecommendation,
} from "@/services/aiApi";
import {
  fetchProductConfigs,
  type ProductConfig,
} from "@/services/productConfigApi";

import type {
  Advisor,
  AiHealth,
  AiRecommendationResponse,
  ContextLevel,
} from "@/types/chat";


interface AiChatProps {
  initialProductIds?: string[];
}


const LEVELS: ContextLevel[] = [
  "unknown",
  "low",
  "medium",
  "high",
];


export function AiChat({ initialProductIds = [] }: AiChatProps) {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [health, setHealth] = useState<AiHealth | null>(null);

  const [advisorId, setAdvisorId] = useState("");
  const [productId, setProductId] = useState(initialProductIds[0] ?? "");

  const [budget, setBudget] = useState("");
  const [urgency, setUrgency] = useState<ContextLevel>("unknown");
  const [replacementNeed, setReplacementNeed] = useState<ContextLevel>("unknown");
  const [priceSensitivity, setPriceSensitivity] = useState<ContextLevel>("unknown");

  const [similarProductName, setSimilarProductName] = useState("");
  const [similarProductCondition, setSimilarProductCondition] = useState("working");
  const [notes, setNotes] = useState("");

  const [result, setResult] = useState<AiRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => products.filter(product => product.archived_at == null),
    [products],
  );

  const selectedProduct =
    activeProducts.find(product => product.id === productId) ?? null;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [advisorData, productData, healthData] = await Promise.all([
          getAdvisors(),
          fetchProductConfigs(),
          getAiHealth(),
        ]);

        setAdvisors(advisorData);
        setProducts(productData);
        setHealth(healthData);

        setAdvisorId(current => current || advisorData[0]?.id || "");
        setProductId(current => {
          if (current && productData.some(product => product.id === current && product.archived_at == null)) {
            return current;
          }

          return productData.find(product => product.archived_at == null)?.id ?? "";
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load AI Advisor.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);


  async function runAdvisor() {
    if (!advisorId || !productId || running) return;

    const parsedBudget = budget.trim() === ""
      ? null
      : Number(budget);

    if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      setError("Budget must be a positive number or left empty.");
      return;
    }

    const noteLines = notes
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const similarName = similarProductName.trim();

    try {
      setRunning(true);
      setError(null);
      setResult(null);

      const response = await getRecommendation({
        advisorId,
        productId,
        language: "zh",
        userContext: {
          budget: parsedBudget,
          urgency,
          replacementNeed,
          priceSensitivity,
          ownedSimilarProducts: similarName
            ? [
                {
                  name: similarName,
                  condition: similarProductCondition,
                  similarity: "high",
                },
              ]
            : [],
          notes: noteLines,
        },
      });

      setResult(response);
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "AI recommendation failed.",
      );
    } finally {
      setRunning(false);
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading AI Advisor...
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Advisor · Local Test
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            React → ASP.NET Core → V10.3 Local AI → Ollama/Qwen3-8B
          </p>
        </div>

        <div className="rounded-lg border px-3 py-2 text-xs">
          <div className="font-medium">
            {health?.provider === "local" ? "Local AI connected" : "AI provider mismatch"}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {health?.version || "unknown"} · {health?.localModel || "unknown model"}
          </div>
        </div>
      </div>

      {health?.provider !== "local" && (
        <Card className="border-destructive p-4 text-sm text-destructive">
          This test page expected the local provider, but AI reports provider:
          {" "}{health?.provider || "unknown"}.
        </Card>
      )}

      {error && (
        <Card className="border-destructive p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="font-semibold">Test input</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Product price/history comes from PriceWatch. The fields below only add optional user context.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={productId}
                disabled={running}
                onChange={event => setProductId(event.target.value)}
              >
                {activeProducts.length === 0 && <option value="">No active products</option>}
                {activeProducts.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Advisor">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={advisorId}
                disabled={running}
                onChange={event => setAdvisorId(event.target.value)}
              >
                {advisors.map(advisor => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selectedProduct && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Target: {selectedProduct.target_price} {selectedProduct.currency}
              {selectedProduct.last_purchase_price != null && (
                <> · Last bought: {selectedProduct.last_purchase_price} {selectedProduct.currency}</>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget (optional)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={budget}
                disabled={running}
                placeholder="e.g. 4500"
                onChange={event => setBudget(event.target.value)}
              />
            </Field>

            <LevelSelect
              label="Urgency"
              value={urgency}
              disabled={running}
              onChange={setUrgency}
            />

            <LevelSelect
              label="Replacement need"
              value={replacementNeed}
              disabled={running}
              onChange={setReplacementNeed}
            />

            <LevelSelect
              label="Price sensitivity"
              value={priceSensitivity}
              disabled={running}
              onChange={setPriceSensitivity}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Existing similar product (optional)">
              <Input
                value={similarProductName}
                disabled={running}
                placeholder="e.g. Sony WH-1000XM5"
                onChange={event => setSimilarProductName(event.target.value)}
              />
            </Field>

            <Field label="Existing product condition">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={similarProductCondition}
                disabled={running || !similarProductName.trim()}
                onChange={event => setSimilarProductCondition(event.target.value)}
              >
                <option value="working">Working</option>
                <option value="good">Good</option>
                <option value="broken">Broken</option>
                <option value="unusable">Unusable</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
          </div>

          <Field label="Other context (one fact per line)">
            <Textarea
              value={notes}
              disabled={running}
              placeholder={"Long flight tomorrow.\nNeed a replacement before the trip."}
              onChange={event => setNotes(event.target.value)}
            />
          </Field>

          <Button
            type="button"
            className="w-full"
            disabled={running || !productId || !advisorId || health?.provider !== "local"}
            onClick={() => void runAdvisor()}
          >
            {running ? "Running Qwen3-8B..." : "Run Local Advisor"}
          </Button>
        </Card>

        <Card className="min-h-[520px] p-5">
          {!result ? (
            <div className="flex h-full min-h-[480px] items-center justify-center text-center text-sm text-muted-foreground">
              Run the local advisor to see the V10.3 structured result.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {result.advisorName}
                  </div>
                  <div className="mt-1 text-4xl font-semibold tracking-tight">
                    {result.decision}
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="text-muted-foreground">Confidence</div>
                  <div className="font-medium capitalize">{result.confidence}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">Drivers</div>
                <div className="flex flex-wrap gap-2">
                  {result.drivers.map(driver => (
                    <span
                      key={driver}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                    >
                      {driver}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium">Python factual render</div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {result.renderedText}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Selected fact explanations</div>
                {result.explanations.map(explanation => (
                  <div key={explanation.code} className="rounded-lg border p-3">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {explanation.code} · {explanation.label}
                    </div>
                    <div className="mt-1 text-sm">{explanation.text}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-3">
                <Meta label="Provider" value={result.meta.provider} />
                <Meta label="Model" value={result.meta.model ?? "unknown"} />
                <Meta label="Latency" value={`${result.meta.latencyMs} ms`} />
                <Meta label="Attempts" value={String(result.meta.attempts)} />
                <Meta label="Input tokens" value={String(result.meta.usage?.inputTokens ?? "-")} />
                <Meta label="Output tokens" value={String(result.meta.usage?.outputTokens ?? "-")} />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}


function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}


function LevelSelect({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: ContextLevel;
  disabled: boolean;
  onChange: (value: ContextLevel) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="h-9 w-full rounded-md border bg-background px-3 text-sm capitalize"
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as ContextLevel)}
      >
        {LEVELS.map(level => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </Field>
  );
}


function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div>{label}</div>
      <div className="mt-0.5 break-all font-medium text-foreground">{value}</div>
    </div>
  );
}
