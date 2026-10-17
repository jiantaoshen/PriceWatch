namespace PriceWatch.Data.Entities;

public class BestPriceState
{
    public long Id { get; set; }

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public decimal UnitPrice { get; set; }

    public BestPriceChangeCause Cause { get; set; }

    public DateTimeOffset RecordedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<BestPriceStateSource> Sources { get; set; } = [];
}
