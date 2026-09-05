namespace PriceWatch.Api.Models; 

public record ChatMessage(
    string Role,
    string Content
);

public record ChatRequest(
    string CharacterId,
    List<ChatMessage> Messages
);

public record CharacterDto(
    string Id,
    string Name,
    int Age,
    string Occupation,
    string Greeting
);