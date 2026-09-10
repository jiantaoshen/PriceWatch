// ============================================================================
// File: DTOs/ProductLifecycleInputs.cs
// Purpose:
//   Defines small, action-specific inputs for changing a saved product's
//   lifecycle without touching its scraper configuration.
//
// Main types:
//   - MarkProductOwnedInput: optional purchase price/date.
//   - MarkSubscriptionInput: optional paid price, billing period, renewal date.
//
// Inputs:
//   JSON bodies sent to lifecycle endpoints.
//
// Outputs:
//   ProductConfigService uses these values to return an updated ProductConfig.
//   Mark-as-tracked needs no DTO because it intentionally clears lifecycle data.
// ============================================================================

using System.Text.Json.Serialization;

using PriceWatch.Api.Models;

namespace PriceWatch.Api.DTOs;


public sealed class MarkProductOwnedInput
{
    [JsonPropertyName("purchase_price")]
    public double? PurchasePrice { get; init; }

    [JsonPropertyName("purchase_date")]
    public DateOnly? PurchaseDate { get; init; }
}


public sealed class MarkSubscriptionInput
{
    [JsonPropertyName("subscription_price")]
    public double? SubscriptionPrice { get; init; }

    [JsonPropertyName("billing_interval")]
    public BillingInterval? BillingInterval { get; init; }

    [JsonPropertyName("next_billing_date")]
    public DateOnly? NextBillingDate { get; init; }
}
