import { useEffect, useRef } from "react";
import { Bot, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { Advisor, Message } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  selectedAdvisor: Advisor;
  isGenerating: boolean;
  onRegenerate: () => void;
}

export function MessageList({
  messages,
  selectedAdvisor,
  isGenerating,
  onRegenerate,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <ScrollArea className="h-full">
      <div className="p-5">
        {messages.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="max-w-md space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="size-6" />
              </div>

              <div>
                <h2 className="font-semibold">
                  {selectedAdvisor.name}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedAdvisor.description}
                </p>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                {selectedAdvisor.greeting}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message, index) => {
              const isUser = message.role === "user";

              const isLastAssistant =
                message.role === "assistant" &&
                index === messages.length - 1;

              return (
                <div
                  key={index}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%] space-y-2">
                    <div
                      className={
                        isUser
                          ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                          : "rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm text-foreground"
                      }
                    >
                      <p className="whitespace-pre-wrap break-words leading-6">
                        {message.content ||
                          (message.role === "assistant" && isGenerating
                            ? "..."
                            : "")}
                      </p>
                    </div>

                    {isLastAssistant &&
                      !isGenerating &&
                      message.content && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={onRegenerate}
                        >
                          <RefreshCw data-icon="inline-start" />
                          Regenerate
                        </Button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}