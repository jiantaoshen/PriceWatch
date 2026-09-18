namespace PriceWatch.Data.Entities;

public class PriceHistory
{
    public long Id { get; set; }

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public long? SourceId { get; set; }

    public ItemSource? Source { get; set; }

    public long? ScrapeResultId { get; set; }

    public ScrapeResult? ScrapeResult { get; set; }


    // 当时实际商品/套餐价格
    public decimal Price { get; set; }

    // 当时包含多少 normalized units
    public decimal Quantity { get; set; }

    // PostgreSQL generated
    public decimal UnitPrice { get; private set; }

    public PriceOrigin Origin { get; set; }

    public DateTimeOffset RecordedAt { get; set; }
        = DateTimeOffset.UtcNow;
}