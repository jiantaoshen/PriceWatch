import { Bot } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Character } from "@/types/chat";

interface CharacterHeaderProps {
  characters: Character[];
  selectedCharacter: Character;
  selectedCharacterId: string;
  isGenerating: boolean;
  onCharacterChange: (characterId: string) => void;
}

export function CharacterHeader({
  characters,
  selectedCharacter,
  selectedCharacterId,
  isGenerating,
  onCharacterChange,
}: CharacterHeaderProps) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-4">
      <Avatar className="size-10">
        <AvatarFallback>
          {selectedCharacter.name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate font-semibold">
            {selectedCharacter.name}
          </h2>

          <Bot className="size-4 text-muted-foreground" />
        </div>

        {selectedCharacter.occupation && (
          <p className="truncate text-sm text-muted-foreground">
            {selectedCharacter.occupation}
          </p>
        )}
      </div>

      <Select
        value={selectedCharacterId}
        onValueChange={onCharacterChange}
        disabled={isGenerating}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {characters.map(character => (
            <SelectItem key={character.id} value={character.id}>
              {character.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

