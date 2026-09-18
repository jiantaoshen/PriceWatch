namespace PriceWatch.Data.Entities;

public class PriceAlertEvent
{
    public long Id { get; set; }

    public Guid ItemId { get; set; }

    public TrackedItem Item { get; set; } = null!;

    public long PriceHistoryId { get; set; }

    public PriceHistory PriceHistory { get; set; } = null!;

    public decimal UnitPrice { get; set; }

    public decimal TargetUnitPrice { get; set; }

    public AlertStatus Status { get; set; }
        = AlertStatus.Pending;

    public DateTimeOffset CreatedAt { get; set; }
        = DateTimeOffset.UtcNow;

    public DateTimeOffset? SentAt { get; set; }

    public string? Error { get; set; }
}