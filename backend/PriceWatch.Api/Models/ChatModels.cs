namespace PriceWatch.Api.Models;

public sealed class AdvisorDto
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Title { get; init; } = "";
    public string Description { get; init; } = "";
    public string Greeting { get; init; } = "";
}

public sealed class ChatMessage
{
    public string Role { get; init; } = "";
    public string Content { get; init; } = "";
}

public sealed class AiChatRequest
{
    public string AdvisorId { get; init; } = "";
    public List<string> ProductIds { get; init; } = [];
    public List<ChatMessage> Messages { get; init; } = [];
}

public sealed class AiPricePoint
{
    public string Date { get; init; } = "";
    public double Price { get; init; }
}

public sealed class AiProductContext
{
    public string ProductId { get; init; } = "";
    public string Name { get; init; } = "";
    public string Currency { get; init; } = "";

    public double? CurrentPrice { get; init; }
    public double? TargetPrice { get; init; }
    public double? PreviousPrice { get; init; }

    public double? HistoricalLow { get; init; }
    public double? HistoricalHigh { get; init; }
    public double? HistoricalAverage { get; init; }

    public List<AiPricePoint> History { get; init; } = [];
}

public sealed class AiChatPayload
{
    public string AdvisorId { get; init; } = "";
    public IReadOnlyList<AiProductContext> Products { get; init; } = [];
    public IReadOnlyList<ChatMessage> Messages { get; init; } = [];
}
