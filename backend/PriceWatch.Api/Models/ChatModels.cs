// ============================================================================
// File: Models/ChatModels.cs
// Purpose:
//   Defines the API models used by PriceWatch chat/advisor requests. Product
//   context now carries scraper price facts, unit-price facts, and the small
//   owned/subscription lifecycle fields without changing the advisor response
//   contract itself.
//
// Main types:
//   - AdvisorDto: advisor metadata shown by the frontend.
//   - ChatMessage / AiChatRequest: incoming chat request data.
//   - AiPricePoint: one historical total/unit price observation.
//   - AiProductContext: normalized product facts prepared for AI.
//   - AiChatPayload: complete payload passed to IAiService.
//
// Inputs:
//   Product IDs, chat messages, ProductConfig data, latest.json and history files.
//
// Outputs:
//   Strongly typed context consumed by AiService before it calls the AI backend.
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
    public double? UnitPrice { get; init; }
}


public sealed class AiProductContext
{
    public string ProductId { get; init; } = "";
    public string Name { get; init; } = "";
    public string Currency { get; init; } = "";

    public SavedProductType SavedType { get; init; } = SavedProductType.Tracked;

    public double? ComparisonQuantity { get; init; }
    public string? Unit { get; init; }

    // Total/comparable-total price facts.
    public double? CurrentPrice { get; init; }
    public double? TargetPrice { get; init; }
    public double? PreviousPrice { get; init; }
    public double? HistoricalLow { get; init; }
    public double? HistoricalHigh { get; init; }
    public double? HistoricalAverage { get; init; }

    // Unit-price facts. These are important for products whose package sizes differ.
    public double? CurrentUnitPrice { get; init; }
    public double? TargetUnitPrice { get; init; }
    public double? PreviousUnitPrice { get; init; }
    public double? HistoricalLowUnitPrice { get; init; }
    public double? HistoricalHighUnitPrice { get; init; }
    public double? HistoricalAverageUnitPrice { get; init; }

    // Owned lifecycle context.
    public double? PurchasePrice { get; init; }
    public DateOnly? PurchaseDate { get; init; }

    // Subscription lifecycle context.
    public double? SubscriptionPrice { get; init; }
    public BillingInterval? BillingInterval { get; init; }
    public DateOnly? NextBillingDate { get; init; }

    public List<AiPricePoint> History { get; init; } = [];
}


public sealed class AiChatPayload
{
    public string AdvisorId { get; init; } = "";
    public IReadOnlyList<AiProductContext> Products { get; init; } = [];
    public IReadOnlyList<ChatMessage> Messages { get; init; } = [];
}
