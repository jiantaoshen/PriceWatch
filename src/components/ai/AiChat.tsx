import { useEffect, useRef, useState } from "react";

import { AdvisorHeader } from "@/components/ai/CharacterHeader";
import { ChatInput } from "@/components/ai/ChatInput";
import { MessageList } from "@/components/ai/MessageList";
import { ProductPicker } from "@/components/ai/ProductPicker";
import { Card } from "@/components/ui/card";

import { getAdvisors, streamChat } from "@/services/aiApi";
import { fetchProductConfigs } from "@/services/productConfigApi";

import type { ProductConfig } from "@/services/productConfigApi";
import type { Advisor, Message } from "@/types/chat";

interface AiChatProps {
  initialProductIds?: string[];
}

export function AiChat({
  initialProductIds = [],
}: AiChatProps) {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [products, setProducts] = useState<ProductConfig[]>([]);

  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedAdvisor =
    advisors.find(advisor => advisor.id === selectedAdvisorId) ?? null;

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [advisorData, productData] = await Promise.all([
          getAdvisors(),
          fetchProductConfigs(),
        ]);

        setAdvisors(advisorData);
        setProducts(productData);
        setSelectedAdvisorId(advisorData[0]?.id ?? "");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load AI Chat.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function generateReply(context: Message[]) {
    if (!selectedAdvisorId) return;

    const controller = new AbortController();

    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      await streamChat({
        advisorId: selectedAdvisorId,
        productIds: selectedProductIds,
        messages: context,
        signal: controller.signal,

        onChunk: chunk => {
          setMessages(current => {
            const next = [...current];
            const last = next.at(-1);

            if (last?.role !== "assistant") {
              return current;
            }

            next[next.length - 1] = {
              ...last,
              content: last.content + chunk,
            };

            return next;
          });
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      setMessages(current => {
        const next = [...current];

        if (next.at(-1)?.role === "assistant") {
          next[next.length - 1] = {
            role: "assistant",
            content: `Request failed: ${message}`,
          };
        }

        return next;
      });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  async function sendMessage() {
    const text = input.trim();

    if (!text || isGenerating || !selectedAdvisor) {
      return;
    }

    const context: Message[] = [
      ...messages,
      {
        role: "user",
        content: text,
      },
    ];

    setInput("");

    setMessages([
      ...context,
      {
        role: "assistant",
        content: "",
      },
    ]);

    await generateReply(context);
  }

  async function regenerate() {
    if (isGenerating || !selectedAdvisor) {
      return;
    }

    const context = [...messages];

    if (context.at(-1)?.role === "assistant") {
      context.pop();
    }

    if (context.at(-1)?.role !== "user") {
      return;
    }

    setMessages([
      ...context,
      {
        role: "assistant",
        content: "",
      },
    ]);

    await generateReply(context);
  }

  function changeAdvisor(advisorId: string) {
    abortControllerRef.current?.abort();

    setSelectedAdvisorId(advisorId);
    setMessages([]);
    setInput("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading AI advisors...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Unable to load AI Chat
            </h2>

            <p className="text-sm text-destructive">
              {error}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!selectedAdvisor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        No AI advisors available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI Chat
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Analyze your tracked prices with different shopping advisors.
        </p>
      </div>

      <Card className="flex h-[calc(100vh-15rem)] min-h-[560px] flex-col overflow-hidden p-0">
        <AdvisorHeader
          advisors={advisors}
          selectedAdvisor={selectedAdvisor}
          selectedAdvisorId={selectedAdvisorId}
          isGenerating={isGenerating}
          onAdvisorChange={changeAdvisor}
        />

        <ProductPicker
          products={products}
          selectedProductIds={selectedProductIds}
          disabled={isGenerating}
          onChange={setSelectedProductIds}
        />

        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages}
            selectedAdvisor={selectedAdvisor}
            isGenerating={isGenerating}
            onRegenerate={regenerate}
          />
        </div>

        <ChatInput
          input={input}
          advisorName={selectedAdvisor.name}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onSend={sendMessage}
          onStop={() => abortControllerRef.current?.abort()}
        />
      </Card>
    </div>
  );
}