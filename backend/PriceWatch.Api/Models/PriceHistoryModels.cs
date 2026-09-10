// ============================================================================
// File: Models/PriceHistoryModels.cs
// Purpose:
//   Defines the compact, current PriceWatch history JSON schema. History is a
//   price time series only; full scraper status, offers, URLs and targets stay in
//   latest.json or ProductConfig and are intentionally not duplicated here.
//
// Main types:
//   - PriceHistoryEntry: one accepted product price observation.
//   - PriceHistoryFile: one dated history period containing accepted observations.
//   - PriceHistoryIndex: list of available history periods.
//
// Inputs:
//   data/history/index.json and data/history/YYYY-MM-DD.json written by scraper
//   or PriceReviewService after a suspicious price is confirmed.
//
// Outputs:
//   Strongly typed compact history data used by API services such as
//   AiProductContextService.
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.Models;


[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PriceHistoryEntry
{
    [JsonPropertyName("product_id")]
    [JsonRequired]
    public string ProductId { get; init; } = "";

    [JsonPropertyName("current_price")]
    [JsonRequired]
    public double CurrentPrice { get; init; }

    [JsonPropertyName("current_unit_price")]
    public double? CurrentUnitPrice { get; init; }
}


[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PriceHistoryFile
{
    [JsonPropertyName("period")]
    [JsonRequired]
    public string Period { get; init; } = "";

    [JsonPropertyName("generated_at")]
    [JsonRequired]
    public string GeneratedAt { get; init; } = "";

    [JsonPropertyName("data")]
    [JsonRequired]
    public List<PriceHistoryEntry> Data { get; init; } = [];
}


[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PriceHistoryIndex
{
    [JsonPropertyName("periods")]
    [JsonRequired]
    public List<string> Periods { get; init; } = [];
}
