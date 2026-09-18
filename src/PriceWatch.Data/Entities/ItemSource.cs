using Microsoft.EntityFrameworkCore;

namespace PriceWatch.Data.Entities;

public class ItemSource
{
    public long Id { get; set; }

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public string Store { get; set; } = string.Empty;

    public string? Url { get; set; }

    public bool ScrapingEnabled { get; set; }

    public decimal DefaultQuantity { get; set; } = 1m;

    [Precision(18, 4)]
    public decimal? ManualPrice { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
