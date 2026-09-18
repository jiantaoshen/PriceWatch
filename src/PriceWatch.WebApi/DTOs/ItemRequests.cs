using PriceWatch.Data.Entities;

namespace PriceWatch.WebApi.DTOs;

public sealed class CreateItemRequest
{
    public ItemType ItemType { get; init; } = ItemType.Product;

    public string Name { get; init; } = string.Empty;

    public string Currency { get; init; } = "SEK";

    public string? Unit { get; init; }

    public decimal? TargetPrice { get; init; }

    public decimal ComparisonQuantity { get; init; } = 1m;

    public decimal? LastPurchasePrice { get; init; }

    public DateOnly? LastPurchaseDate { get; init; }

    public UpdateMode UpdateMode { get; init; } = UpdateMode.Manual;

    public int? CheckIntervalMinutes { get; init; }

    public bool TrackingEnabled { get; init; } = true;
}

public sealed class UpdateItemRequest
{
    public ItemType ItemType { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Currency { get; init; } = "SEK";

    public string? Unit { get; init; }

    public decimal? TargetPrice { get; init; }

    public decimal ComparisonQuantity { get; init; } = 1m;

    public decimal? LastPurchasePrice { get; init; }

    public DateOnly? LastPurchaseDate { get; init; }

    public UpdateMode UpdateMode { get; init; }

    public int? CheckIntervalMinutes { get; init; }

    public bool TrackingEnabled { get; init; }
}

public sealed class CreateSourceRequest
{
    public string Store { get; init; } = string.Empty;

    public string? Url { get; init; }

    public bool ScrapingEnabled { get; init; } = true;

    public decimal DefaultQuantity { get; init; } = 1m;

    public decimal? ManualPrice { get; init; }

    public string? Note { get; init; }
}

public sealed class UpdateSourceRequest
{
    public string Store { get; init; } = string.Empty;

    public string? Url { get; init; }

    public bool ScrapingEnabled { get; init; }

    public decimal DefaultQuantity { get; init; } = 1m;

    public decimal? ManualPrice { get; init; }

    public string? Note { get; init; }
}
