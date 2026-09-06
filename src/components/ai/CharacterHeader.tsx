import { Bot } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Advisor } from "@/types/chat";

interface AdvisorHeaderProps {
  advisors: Advisor[];
  selectedAdvisor: Advisor;
  selectedAdvisorId: string;
  isGenerating: boolean;
  onAdvisorChange: (advisorId: string) => void;
}

export function AdvisorHeader({
  advisors,
  selectedAdvisor,
  selectedAdvisorId,
  isGenerating,
  onAdvisorChange,
}: AdvisorHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Bot className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">
          {selectedAdvisor.name}
        </h2>

        <p className="truncate text-sm text-muted-foreground">
          {selectedAdvisor.title}
        </p>
      </div>

      <Select
        value={selectedAdvisorId}
        onValueChange={onAdvisorChange}
        disabled={isGenerating}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {advisors.map(advisor => (
            <SelectItem key={advisor.id} value={advisor.id}>
              {advisor.name} · {advisor.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}