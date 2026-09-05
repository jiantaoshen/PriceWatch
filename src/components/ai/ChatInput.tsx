import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  input: string;
  characterName: string;
  isGenerating: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  characterName,
  isGenerating,
  onInputChange,
  onSend,
  onStop,
}: ChatInputProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    onSend();
  }

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-3">
        <Textarea
          value={input}
          onChange={event => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`和 ${characterName} 说点什么...`}
          disabled={isGenerating}
          rows={1}
          className="min-h-11 max-h-40 resize-none"
        />

        {isGenerating ? (
          <Button type="button" variant="destructive" onClick={onStop}>
            <Square data-icon="inline-start" />
            停止
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!input.trim()}
            onClick={onSend}
          >
            <Send data-icon="inline-start" />
            发送
          </Button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>Enter 发送 · Shift + Enter 换行</span>
        <span>AI：Summary + 最近 20 条</span>
      </div>
    </div>
  );
}
