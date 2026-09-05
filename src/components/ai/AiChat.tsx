import { useEffect, useRef, useState } from "react";

import { CharacterHeader } from "@/components/ai/CharacterHeader";
import { ChatInput } from "@/components/ai/ChatInput";
import { MessageList } from "@/components/ai/MessageList";
import { Card } from "@/components/ui/card";

import { getCharacters, streamChat } from "@/services/aiApi";

import type { Character, Message } from "@/types/chat";

export function AiChat() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedCharacter =
    characters.find(character => character.id === selectedCharacterId) ?? null;

  useEffect(() => {
    async function loadCharacters() {
      try {
        setLoading(true);
        setError(null);

        const data = await getCharacters();

        setCharacters(data);
        setSelectedCharacterId(data[0]?.id ?? "");
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load characters.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCharacters();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function generateReply(context: Message[]) {
    if (!selectedCharacterId) return;

    const controller = new AbortController();

    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      await streamChat({
        characterId: selectedCharacterId,
        messages: context,
        signal: controller.signal,
        onChunk: chunk => {
          setMessages(current => {
            const next = [...current];
            const last = next.at(-1);

            if (last?.role !== "assistant") return current;

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
        const last = next.at(-1);

        if (last?.role !== "assistant") {
          return current;
        }

        next[next.length - 1] = {
          role: "assistant",
          content: `请求失败：${message}`,
        };

        return next;
      });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  async function sendMessage() {
    const text = input.trim();

    if (!text || isGenerating || !selectedCharacter) return;

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
    if (isGenerating || !selectedCharacter) return;

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

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  function changeCharacter(characterId: string) {
    abortControllerRef.current?.abort();

    setSelectedCharacterId(characterId);
    setMessages([]);
    setInput("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        正在加载角色...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              无法加载角色
            </h2>

            <p className="text-sm text-destructive">
              {error}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!selectedCharacter) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        暂无可用角色
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
          Chat with your local AI using the selected character.
        </p>
      </div>

      <Card className="flex h-[calc(100vh-15rem)] min-h-[520px] flex-col overflow-hidden p-0">
        <CharacterHeader
          characters={characters}
          selectedCharacter={selectedCharacter}
          selectedCharacterId={selectedCharacterId}
          isGenerating={isGenerating}
          onCharacterChange={changeCharacter}
        />

        <div className="min-h-0 flex-1">
          <MessageList
            messages={messages}
            selectedCharacter={selectedCharacter}
            isGenerating={isGenerating}
            onRegenerate={regenerate}
          />
        </div>

        <ChatInput
          input={input}
          characterName={selectedCharacter.name}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      </Card>
    </div>
  );
}

