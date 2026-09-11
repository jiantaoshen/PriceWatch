// ============================================================================
// File: Models/Subscription.cs
// Purpose:
//   Defines subscriptions as a separate domain from scraper-tracked products.
//   Subscription records live in data/subscriptions.json and are never sent to
//   the product scraper.
//
// Main types:
//   - BillingInterval: supported billing periods.
//   - Subscription: one recurring expense managed by the user.
//
// Inputs:
//   JSON from data/subscriptions.json and values mapped from SubscriptionInput.
//
// Outputs:
//   Serialized subscription records returned by /api/subscriptions and consumed
//   by the dedicated Subscriptions frontend tab.
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.Models;


public enum BillingInterval
{
    Weekly = 0,
    Monthly = 1,
    Quarterly = 2,
    Yearly = 3,
}


public sealed class Subscription
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = "";

    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("price")]
    public double Price { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "SEK";

    [JsonPropertyName("billing_interval")]
    public BillingInterval BillingInterval { get; init; } = BillingInterval.Monthly;

    [JsonPropertyName("next_billing_date")]
    public DateOnly? NextBillingDate { get; init; }

    [JsonPropertyName("is_active")]
    public bool IsActive { get; init; } = true;

    [JsonPropertyName("note")]
    public string? Note { get; init; }
}
