// ============================================================================
// File: DTOs/PriceReviewInputs.cs
// Purpose:
//   Defines the small user inputs used by the Price Review workflow. A suspicious
//   scraped price can be confirmed without changing scraper configuration, while
//   a manual price is attached to one existing source and switches that source
//   into manual mode until the user enables scraping again.
//
// Main types:
//   - SetManualSourcePriceInput: source URL + user-entered actual package price.
//
// Inputs:
//   JSON body from POST /api/product-config/{id}/price-review/manual.
//
// Outputs:
//   Validated values consumed by ProductConfigService.SetManualSourcePriceAsync().
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.DTOs;


public sealed class SetManualSourcePriceInput
{
    [JsonPropertyName("source_url")]
    public string SourceUrl { get; init; } = "";

    [JsonPropertyName("manual_price")]
    public double ManualPrice { get; init; }
}
