// ============================================================================
// File: Models/ProductConfig.cs
// Purpose:
//   Defines the persistent product configuration written to python/products.json.
//   This stays scraper-oriented and only adds a small lifecycle layer so the same
//   product can be tracked, marked as owned, or managed as a subscription.
//
// Main types:
//   - SavedProductType: tracked / owned / subscription lifecycle state.
//   - BillingInterval: supported recurring billing periods for subscriptions.
//   - ProductSource: one scraper/manual store source.
//   - ProductConfig: complete saved configuration for one PriceWatch product.
//
// Inputs:
//   Deserialized JSON from python/products.json and values mapped from API DTOs.
//
// Outputs:
//   Serialized JSON consumed by the ASP.NET API, frontend, and Python scraper.
//   Persisted data must follow the current schema; legacy missing fields are not inferred.
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.Models;


public enum SavedProductType
{
    Tracked = 0,
    Owned = 1,
    Subscription = 2,
}


public enum BillingInterval
{
    Weekly = 0,
    Monthly = 1,
    Quarterly = 2,
    Yearly = 3,
}


public sealed class ProductSource
{
    [JsonPropertyName("store")]
    public string Store { get; init; } = "";

    [JsonPropertyName("url")]
    public string Url { get; init; } = "";

    [JsonPropertyName("scraping_enabled")]
    public bool ScrapingEnabled { get; init; } = true;

    [JsonPropertyName("manual_price")]
    public double? ManualPrice { get; init; }

    [JsonPropertyName("unit_quantity")]
    public double? UnitQuantity { get; init; }

    [JsonPropertyName("note")]
    public string? Note { get; init; }
}


public sealed class ProductConfig
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = "";

    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("saved_type")]
    [JsonRequired]
    public SavedProductType SavedType { get; init; }

    [JsonPropertyName("scraping_enabled")]
    public bool ScrapingEnabled { get; init; } = true;

    [JsonPropertyName("comparison_quantity")]
    public double? ComparisonQuantity { get; init; }

    [JsonPropertyName("sources")]
    public List<ProductSource> Sources { get; init; } = [];

    [JsonPropertyName("target_price")]
    public double TargetPrice { get; init; }

    [JsonPropertyName("target_unit_price")]
    public double? TargetUnitPrice { get; init; }

    [JsonPropertyName("unit")]
    public string? Unit { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "SEK";

    // ------------------------------------------------------------------------
    // Owned product lifecycle fields.
    // They are optional because the user should not be forced to fill them.
    // ------------------------------------------------------------------------

    [JsonPropertyName("purchase_price")]
    public double? PurchasePrice { get; init; }

    [JsonPropertyName("purchase_date")]
    public DateOnly? PurchaseDate { get; init; }

    // ------------------------------------------------------------------------
    // Subscription lifecycle fields.
    // SubscriptionPrice is what the user actually pays, which may differ from
    // the currently scraped public price.
    // ------------------------------------------------------------------------

    [JsonPropertyName("subscription_price")]
    public double? SubscriptionPrice { get; init; }

    [JsonPropertyName("billing_interval")]
    public BillingInterval? BillingInterval { get; init; }

    [JsonPropertyName("next_billing_date")]
    public DateOnly? NextBillingDate { get; init; }
}
