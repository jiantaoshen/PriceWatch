namespace PriceWatch.Data.Entities;

public class BestPriceStateSource
{
    public Guid ItemId { get; set; }

    public long BestPriceStateId { get; set; }

    public BestPriceState BestPriceState { get; set; } = null!;

    public long SourceId { get; set; }

    public ItemSource Source { get; set; } = null!;
}
