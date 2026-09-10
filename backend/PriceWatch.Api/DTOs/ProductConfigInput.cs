// ============================================================================
// File: DTOs/ProductConfigInput.cs
// Purpose:
//   Defines the create/edit input for scraper configuration only.
//   Lifecycle fields such as purchase/subscription data intentionally do NOT
//   live here, so editing a target price or source cannot accidentally erase
//   ownership/subscription information.
//
// Main types:
//   - ProductSourceInput: one source entered by the user.
//   - ProductConfigInput: normal add/edit product form payload.
//
// Inputs:
//   JSON body from POST /api/product-config and PUT /api/product-config/{id}.
//
// Outputs:
//   Validated values mapped by ProductConfigService into ProductConfig.
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.DTOs;


public sealed class ProductSourceInput
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


public sealed class ProductConfigInput
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("scraping_enabled")]
    public bool ScrapingEnabled { get; init; } = true;

    [JsonPropertyName("comparison_quantity")]
    public double? ComparisonQuantity { get; init; }

    [JsonPropertyName("sources")]
    public List<ProductSourceInput> Sources { get; init; } = [];

    [JsonPropertyName("target_price")]
    public double TargetPrice { get; init; }

    [JsonPropertyName("target_unit_price")]
    public double? TargetUnitPrice { get; init; }

    [JsonPropertyName("unit")]
    public string? Unit { get; init; }

    [JsonPropertyName("currency")]
    public string Currency { get; init; } = "SEK";
}
