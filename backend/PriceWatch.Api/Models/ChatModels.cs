// ============================================================================
// File: Models/ChatModels.cs
// Purpose:
//   Defines the structured V10.3 PriceWatch Advisor contracts used between React,
//   ASP.NET Core and the Python AI gateway. The legacy filename is retained so the
//   existing project can be upgraded by replacement without adding/removing a C# file.
//   Streaming chat is intentionally no longer part of the AI contract.
//
// Main types:
//   - AdvisorDto: advisor metadata.
//   - AiProductContext: accepted product facts built from current config/history.
//   - AiRecommendationRequest: React request for one product/advisor judgment.
//   - AiUserContextInput / AiSimilarProductInput: optional real-life context.
//   - AiRecommendationResponse: validated V10.3 decision returned by Python.
//
// Inputs:
//   Product ID, advisor, optional user context and accepted PriceWatch data.
//
// Outputs:
//   Structured BUY/WAIT/NEUTRAL result with confidence, drivers, factual
//   explanations and provider metadata.
// ============================================================================

namespace PriceWatch.Api.Models;


public sealed class AdvisorDto
{
    public string Id { get; init; } = "";
    public string Name { get; init; } = "";
    public string Title { get; init; } = "";
    public string Description { get; init; } = "";
    public string Greeting { get; init; } = "";
}


public sealed class AiPricePoint
{
    public string Date { get; init; } = "";
    public double Price { get; init; }
    public double? UnitPrice { get; init; }
}


public sealed class AiProductContext
{
    public string ProductId { get; init; } = "";
    public string Name { get; init; } = "";
    public string Currency { get; init; } = "";

    // Only "success" or "accepted_history" may be sent to V10.3.
    public string PriceStatus { get; init; } = "accepted_history";

    public double? ComparisonQuantity { get; init; }
    public string? Unit { get; init; }

    public double? CurrentPrice { get; init; }
    public double? TargetPrice { get; init; }
    public double? PreviousPrice { get; init; }
    public double? HistoricalLow { get; init; }
    public double? HistoricalHigh { get; init; }
    public double? HistoricalAverage { get; init; }

    // Transported for current Product compatibility. Unit-price and purchase facts
    // are intentionally not V10.3 decision factors until separately benchmarked.
    public double? CurrentUnitPrice { get; init; }
    public double? TargetUnitPrice { get; init; }
    public double? PreviousUnitPrice { get; init; }
    public double? HistoricalLowUnitPrice { get; init; }
    public double? HistoricalHighUnitPrice { get; init; }
    public double? HistoricalAverageUnitPrice { get; init; }
    public double? LastPurchasePrice { get; init; }
    public DateOnly? LastPurchaseDate { get; init; }
    public DateTimeOffset? ArchivedAt { get; init; }

    // Chronological oldest -> newest. This ordering is required by TREND facts.
    public List<AiPricePoint> History { get; init; } = [];
}


public sealed class AiSimilarProductInput
{
    public string Name { get; init; } = "";
    public string Condition { get; init; } = "unknown";
    public string Similarity { get; init; } = "unknown";
}


public sealed class AiUserContextInput
{
    public double? Budget { get; init; }
    public string Urgency { get; init; } = "unknown";
    public string ReplacementNeed { get; init; } = "unknown";
    public string PriceSensitivity { get; init; } = "unknown";
    public List<AiSimilarProductInput> OwnedSimilarProducts { get; init; } = [];
    public List<string> Notes { get; init; } = [];
}


public sealed class AiRecommendationRequest
{
    public string AdvisorId { get; init; } = "";
    public string ProductId { get; init; } = "";
    public AiUserContextInput UserContext { get; init; } = new();
    public string Language { get; init; } = "zh";
}


public sealed class AiDriverExplanation
{
    public string Code { get; init; } = "";
    public string Label { get; init; } = "";
    public string Text { get; init; } = "";
}


public sealed class AiUsageInfo
{
    public int? InputTokens { get; init; }
    public int? OutputTokens { get; init; }
    public int? TotalTokens { get; init; }
}


public sealed class AiRecommendationMeta
{
    public string Provider { get; init; } = "";
    public string? Model { get; init; }
    public int Attempts { get; init; }
    public int LatencyMs { get; init; }
    public string? FinishReason { get; init; }
    public AiUsageInfo? Usage { get; init; }
}


public sealed class AiRecommendationResponse
{
    public string AdvisorId { get; init; } = "";
    public string AdvisorName { get; init; } = "";
    public string Decision { get; init; } = "";
    public string Confidence { get; init; } = "";
    public List<string> Drivers { get; init; } = [];
    public List<AiDriverExplanation> Explanations { get; init; } = [];
    public string RenderedText { get; init; } = "";
    public AiRecommendationMeta Meta { get; init; } = new();
}


public sealed class AiHealthDto
{
    public string Status { get; init; } = "";
    public string Version { get; init; } = "";
    public string Provider { get; init; } = "";
    public string? LocalModel { get; init; }
    public string? CloudRunUrl { get; init; }
    public int Advisors { get; init; }
}
