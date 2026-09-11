// ============================================================================
// File: Models/ProductConfig.cs
// Purpose:
//   Defines the persistent scraper-oriented product configuration stored in
//   python/products.json. A product is either active or archived; purchase data
//   is lightweight "last purchase" context and subscriptions are NOT stored here.
//
// Main types:
//   - ProductSource: one scraper/manual store source.
//   - ProductConfig: one tracked/archived PriceWatch product configuration.
//
// Inputs:
//   Current-format JSON from python/products.json and values mapped from API DTOs.
//
// Outputs:
//   Serialized product configuration consumed by the ASP.NET API and Python
//   scraper. archived_at controls whether the scraper should skip the product.
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.Models;


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

    // Last purchase is context, not a permanent ownership state.
    [JsonPropertyName("last_purchase_price")]
    public double? LastPurchasePrice { get; init; }

    [JsonPropertyName("last_purchase_date")]
    public DateOnly? LastPurchaseDate { get; init; }

    // null = active. Non-null = archived and skipped by the scraper.
    [JsonPropertyName("archived_at")]
    public DateTimeOffset? ArchivedAt { get; init; }
}
