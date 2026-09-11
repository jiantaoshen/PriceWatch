/**
 * File: types/chat.ts
 * Purpose:
 *   Defines the React contracts for the structured V10.3 AI Advisor test flow.
 *   The legacy filename is kept so existing imports can be replaced in place.
 *
 * Main types:
 *   Advisor, AiHealth, AiUserContext, AiRecommendationRequest/Response.
 *
 * Inputs:
 *   Advisor metadata, user context and ASP.NET /api/ai responses.
 *
 * Outputs:
 *   Compile-time types for the local React Advisor test page.
 */

export type ContextLevel = "low" | "medium" | "high" | "unknown";

export interface Advisor {
  id: string;
  name: string;
  title: string;
  description: string;
  greeting: string;
}

export interface AiHealth {
  status: string;
  version: string;
  provider: string;
  localModel: string | null;
  cloudRunUrl: string | null;
  advisors: number;
}

export interface AiSimilarProductInput {
  name: string;
  condition: string;
  similarity: string;
}

export interface AiUserContext {
  budget: number | null;
  urgency: ContextLevel;
  replacementNeed: ContextLevel;
  priceSensitivity: ContextLevel;
  ownedSimilarProducts: AiSimilarProductInput[];
  notes: string[];
}

export interface AiRecommendationRequest {
  advisorId: string;
  productId: string;
  language: "zh" | "en";
  userContext: AiUserContext;
}

export interface AiDriverExplanation {
  code: string;
  label: string;
  text: string;
}

export interface AiUsageInfo {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface AiRecommendationMeta {
  provider: string;
  model: string | null;
  attempts: number;
  latencyMs: number;
  finishReason: string | null;
  usage: AiUsageInfo | null;
}

export interface AiRecommendationResponse {
  advisorId: string;
  advisorName: string;
  decision: "BUY" | "WAIT" | "NEUTRAL";
  confidence: "low" | "medium" | "high";
  drivers: string[];
  explanations: AiDriverExplanation[];
  renderedText: string;
  meta: AiRecommendationMeta;
}
