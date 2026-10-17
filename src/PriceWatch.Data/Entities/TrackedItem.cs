namespace PriceWatch.Data.Entities;

public class TrackedItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public ItemType ItemType { get; set; }

    public string Name { get; set; } = null!;

    public string Currency { get; set; } = "SEK";

    public string? Unit { get; set; }

    public decimal? TargetPrice { get; set; }

    public decimal ComparisonQuantity { get; set; } = 1;

    public decimal? TargetUnitPrice { get; private set; }

    // Representative package values for the current lowest unit price.
    // All tied lowest sources are stored in the latest BestPriceState.
    public decimal? CurrentPrice { get; set; }

    public decimal? CurrentQuantity { get; set; }

    public decimal? CurrentUnitPrice { get; private set; }

    public decimal? PreviousPrice { get; set; }

    public decimal? PreviousQuantity { get; set; }

    public decimal? PreviousUnitPrice { get; private set; }

    public int? CheckIntervalMinutes { get; set; }

    public bool TrackingEnabled { get; set; } = true;

    public DateTimeOffset? LastCheckedAt { get; set; }

    public DateTimeOffset? LastSuccessfulPriceAt { get; set; }

    public DateTimeOffset? LastPriceChangedAt { get; set; }

    public DateTimeOffset? ArchivedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<ItemSource> Sources { get; set; } = [];

    public List<PriceObservation> Observations { get; set; } = [];

    public List<BestPriceState> BestPriceHistory { get; set; } = [];
}
