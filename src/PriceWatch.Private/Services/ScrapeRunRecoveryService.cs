using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Private.Services;

public sealed class ScrapeRunRecoveryService
{
    private readonly PriceWatchDbContext _db;
    private readonly ILogger<ScrapeRunRecoveryService> _logger;

    public ScrapeRunRecoveryService(
        PriceWatchDbContext db,
        ILogger<ScrapeRunRecoveryService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> RecoverAbandonedRunsAsync(
        DateTimeOffset recoveredAt,
        CancellationToken ct = default)
    {
        var runs = await _db.ScrapeRuns
            .Where(x => x.Status == ScrapeRunStatus.Running)
            .ToListAsync(ct);

        if (runs.Count == 0)
        {
            return 0;
        }

        foreach (var run in runs)
        {
            run.Status = ScrapeRunStatus.Abandoned;
            run.FinishedAt ??= recoveredAt;
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogWarning(
            "Recovered {RunCount} stale scrape run(s) as Abandoned after acquiring the global scrape lock.",
            runs.Count);

        return runs.Count;
    }
}
