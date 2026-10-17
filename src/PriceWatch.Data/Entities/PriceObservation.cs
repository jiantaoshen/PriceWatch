namespace PriceWatch.Data.Entities;

public class PriceObservation
{
    public long Id { get; set; }

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public long SourceId { get; set; }

    public ItemSource Source { get; set; } = null!;

    public long? ScrapeResultId { get; set; }

    public ScrapeResult? ScrapeResult { get; set; }

    public decimal Price { get; set; }

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; private set; }

    public PriceOrigin Origin { get; set; }

    public DateTimeOffset ObservedAt { get; set; } = DateTimeOffset.UtcNow;
}
