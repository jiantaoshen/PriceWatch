namespace PriceWatch.Data.Entities;

public class ScrapeResult
{
    public long Id { get; set; }

    public Guid RunId { get; set; }

    public ScrapeRun Run { get; set; } = null!;

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public long? SourceId { get; set; }

    public ItemSource? Source { get; set; }


    // Python / scraper result

    public decimal? ScrapedPrice { get; set; }

    public decimal? ScrapedQuantity { get; set; }

    public decimal? ScrapedUnitPrice { get; private set; }

    public ScrapeResultStatus ResultStatus { get; set; }

    public string? Error { get; set; }

    public string? SuspiciousReason { get; set; }


    // User review

    public ReviewStatus ReviewStatus { get; set; }

    public decimal? ManualPrice { get; set; }

    public decimal? ManualQuantity { get; set; }

    public decimal? ManualUnitPrice { get; private set; }

    public string? ReviewNote { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
        = DateTimeOffset.UtcNow;
}