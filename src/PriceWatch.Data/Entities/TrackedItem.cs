namespace PriceWatch.Data.Entities;

public class TrackedItem
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public ItemType ItemType { get; set; }

    public string Name { get; set; } = null!;

    public string Currency { get; set; } = "SEK";

    public string? Unit { get; set; }


    // -------------------------
    // Target
    // -------------------------

    public decimal? TargetPrice { get; set; }

    public decimal ComparisonQuantity { get; set; } = 1;

    public decimal? TargetUnitPrice { get; private set; }


    // -------------------------
    // Current accepted price
    // -------------------------

    public decimal? CurrentPrice { get; set; }

    public decimal? CurrentQuantity { get; set; }

    public decimal? CurrentUnitPrice { get; private set; }

    public long? CurrentSourceId { get; set; }

    public ItemSource? CurrentSource { get; set; }


    // -------------------------
    // Previous different price
    // -------------------------

    public decimal? PreviousPrice { get; set; }

    public decimal? PreviousQuantity { get; set; }

    public decimal? PreviousUnitPrice { get; private set; }

    public long? PreviousSourceId { get; set; }

    public ItemSource? PreviousSource { get; set; }

    // -------------------------
    // Tracking
    // -------------------------

    public UpdateMode UpdateMode { get; set; } = UpdateMode.Manual;

    public int? CheckIntervalMinutes { get; set; }

    public bool TrackingEnabled { get; set; } = true;


    // -------------------------
    // Times
    // -------------------------

    public DateTimeOffset? LastCheckedAt { get; set; }

    public DateTimeOffset? LastSuccessfulPriceAt { get; set; }

    public DateTimeOffset? LastPriceChangedAt { get; set; }

    public DateTimeOffset? ArchivedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
        = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; }
        = DateTimeOffset.UtcNow;


    public List<ItemSource> Sources { get; set; } = [];

    public List<PriceHistory> PriceHistory { get; set; } = [];
}