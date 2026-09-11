// ============================================================================
// File: DTOs/ProductPurchaseInput.cs
// Purpose:
//   Defines the small input used when a user records that they bought a product.
//   A purchase updates only the latest purchase reference and can optionally
//   archive the product so the scraper stops tracking it.
//
// Main type:
//   - RecordProductPurchaseInput: price/date plus optional archive action.
//
// Inputs:
//   JSON body sent to POST /api/product-config/{id}/purchase.
//
// Outputs:
//   Values consumed by ProductConfigService.RecordPurchaseAsync().
// ============================================================================

using System.Text.Json.Serialization;

namespace PriceWatch.Api.DTOs;


public sealed class RecordProductPurchaseInput
{
    [JsonPropertyName("last_purchase_price")]
    public double? LastPurchasePrice { get; init; }

    [JsonPropertyName("last_purchase_date")]
    public DateOnly? LastPurchaseDate { get; init; }

    [JsonPropertyName("archive_after_purchase")]
    public bool ArchiveAfterPurchase { get; init; }
}
