// ============================================================================
// File: DTOs/SubscriptionInput.cs
// Purpose:
//   Defines create/edit input for the independent subscription module.
//
// Main type:
//   - SubscriptionInput: user-editable recurring expense fields; active/cancelled status
//     is controlled only by dedicated activate/cancel endpoints.
//
// Inputs:
//   JSON body from POST /api/subscriptions and PUT /api/subscriptions/{id}.
//
// Outputs:
//   Validated values mapped by SubscriptionService into Subscription records.
// ============================================================================

using System.Text.Json.Serialization;

using PriceWatch.Api.Models;

namespace PriceWatch.Api.DTOs;


public sealed class SubscriptionInput
{
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

    [JsonPropertyName("note")]
    public string? Note { get; init; }
}
