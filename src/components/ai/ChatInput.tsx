import { Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { KeyboardEvent } from "react";

interface ChatInputProps {
  input: string;
  advisorName: string;
  isGenerating: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export function ChatInput({
  input,
  advisorName,
  isGenerating,
  onInputChange,
  onSend,
  onStop,
}: ChatInputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

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
          placeholder={`Ask ${advisorName} about these prices...`}
          disabled={isGenerating}
          rows={1}
          className="min-h-11 max-h-40 resize-none"
        />

        {isGenerating ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onStop}
          >
            <Square data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!input.trim()}
            onClick={onSend}
          >
            <Send data-icon="inline-start" />
            Send
          </Button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>
          Enter to send · Shift + Enter for new line
        </span>

        <span>
          PriceWatch data + conversation context
        </span>
      </div>
    </div>
  );
}