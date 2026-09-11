/**
 * File: services/aiApi.ts
 * Purpose:
 *   Calls the ASP.NET AI bridge from React. React never talks directly to Ollama
 *   or the Python AI gateway, so the same frontend can later use Cloud Run without
 *   changing browser networking code.
 *
 * Main functions:
 *   - getAiHealth(): verifies ASP.NET -> AI gateway connectivity/provider.
 *   - getAdvisors(): loads Steady/Balanced/Deal Hunter metadata.
 *   - getRecommendation(): requests one V10.3 structured judgment.
 *
 * Inputs:
 *   AiRecommendationRequest containing product ID, advisor and optional context.
 *
 * Outputs:
 *   AiHealth, Advisor[] and AiRecommendationResponse objects.
 */

import { apiJson, jsonRequest } from "@/services/api";

import type {
  Advisor,
  AiHealth,
  AiRecommendationRequest,
  AiRecommendationResponse,
} from "@/types/chat";


export function getAiHealth(): Promise<AiHealth> {
  return apiJson<AiHealth>("/api/ai/health", {
    cache: "no-store",
  });
}


export function getAdvisors(): Promise<Advisor[]> {
  return apiJson<Advisor[]>("/api/advisors", {
    cache: "no-store",
  });
}


export function getRecommendation(
  request: AiRecommendationRequest,
): Promise<AiRecommendationResponse> {
  return apiJson<AiRecommendationResponse>(
    "/api/ai/recommend",
    jsonRequest("POST", request),
  );
}
