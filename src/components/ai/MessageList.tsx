import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { Character, Message } from "@/types/chat";

interface MessageListProps {
  messages: Message[];
  selectedCharacter: Character;
  isGenerating: boolean;
  onRegenerate: () => void;
}

export function MessageList({
  messages,
  selectedCharacter,
  isGenerating,
  onRegenerate,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <ScrollArea className="h-full">
      <div className="p-5">
        {messages.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="max-w-md space-y-4 text-center">
              <Avatar className="mx-auto size-16">
                <AvatarFallback className="text-xl">
                  {selectedCharacter.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div>
                <h2 className="text-lg font-semibold">
                  {selectedCharacter.name}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {selectedCharacter.age}岁 · {selectedCharacter.occupation}
                </p>
              </div>

              {selectedCharacter.greeting && (
                <p className="text-sm leading-6 text-muted-foreground">
                  “{selectedCharacter.greeting}”
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLastAssistant =
                message.role === "assistant" && index === messages.length - 1;

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
                          重新生成
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
