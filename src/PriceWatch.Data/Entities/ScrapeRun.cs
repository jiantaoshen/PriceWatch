namespace PriceWatch.Data.Entities;

public class ScrapeRun
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTimeOffset StartedAt { get; set; }
        = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    public ScrapeRunStatus Status { get; set; }
        = ScrapeRunStatus.Running;

    public int TotalItems { get; set; }

    public int Successful { get; set; }

    public int Failed { get; set; }

    public int Suspicious { get; set; }

    public List<ScrapeResult> Results { get; set; } = [];
}