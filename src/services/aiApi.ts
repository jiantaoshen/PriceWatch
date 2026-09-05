

import type { Character, Message } from "../types/chat";

interface StreamChatOptions {
  characterId: string;
  messages: Message[];
  signal: AbortSignal;
  onChunk: (chunk: string) => void;
}

export async function getCharacters(): Promise<Character[]> {
  const response = await fetch("/api/characters");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function streamChat({
  characterId,
  messages,
  signal,
  onChunk,
}: StreamChatOptions): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, messages }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
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


