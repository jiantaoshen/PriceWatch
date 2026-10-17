using PriceWatch.Data.Entities;

namespace PriceWatch.WebApi.DTOs;

public class CreateItemRequest
{
    public ItemType ItemType { get; init; } = ItemType.Product;
    public string Name { get; init; } = string.Empty;
    public string Currency { get; init; } = "SEK";
    public string? Unit { get; init; }
    public decimal? TargetPrice { get; init; }
    public decimal ComparisonQuantity { get; init; } = 1m;
    public int? CheckIntervalMinutes { get; init; }
    public bool TrackingEnabled { get; init; } = true;
}

public sealed class UpdateItemRequest : CreateItemRequest
{
}

public class CreateSourceRequest
{
    public string Store { get; init; } = string.Empty;
    public string? Url { get; init; }
    public bool ScrapingEnabled { get; init; } = true;
    public decimal DefaultQuantity { get; init; } = 1m;
    public string? Note { get; init; }
}

public sealed class UpdateSourceRequest : CreateSourceRequest
{
}

public sealed class ManualObservationRequest
{
    public decimal Price { get; init; }
    public decimal Quantity { get; init; } = 1m;
}
