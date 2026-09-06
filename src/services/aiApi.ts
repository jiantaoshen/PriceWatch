import { apiJson } from "@/services/api";

import type { Advisor, Message } from "@/types/chat";

interface StreamChatOptions {
  advisorId: string;
  productIds: string[];
  messages: Message[];
  signal: AbortSignal;
  onChunk: (chunk: string) => void;
}

export function getAdvisors(): Promise<Advisor[]> {
  return apiJson<Advisor[]>("/api/advisors", {
    cache: "no-store",
  });
}

export async function streamChat({
  advisorId,
  productIds,
  messages,
  signal,
  onChunk,
}: StreamChatOptions): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      advisorId,
      productIds,
      messages,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }
}