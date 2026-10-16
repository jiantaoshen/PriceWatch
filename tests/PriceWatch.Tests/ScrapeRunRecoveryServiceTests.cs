using Microsoft.Extensions.Logging.Abstractions;
using PriceWatch.Data.Entities;
using PriceWatch.Private.Services;

namespace PriceWatch.Tests;

public sealed class ScrapeRunRecoveryServiceTests
{
    [Fact]
    public async Task RecoverAbandonedRuns_MarksOnlyRunningRowsAbandoned()
    {
        await using var db = TestDb.Create();
        var staleId = Guid.NewGuid();
        var completedId = Guid.NewGuid();
        var recoveredAt = DateTimeOffset.UtcNow;

        db.ScrapeRuns.AddRange(
            new ScrapeRun
            {
                Id = staleId,
                Status = ScrapeRunStatus.Running,
                StartedAt = recoveredAt.AddHours(-1)
            },
            new ScrapeRun
            {
                Id = completedId,
                Status = ScrapeRunStatus.Success,
                StartedAt = recoveredAt.AddHours(-2),
                FinishedAt = recoveredAt.AddHours(-1)
            });
        await db.SaveChangesAsync();

        var service = new ScrapeRunRecoveryService(
            db,
            NullLogger<ScrapeRunRecoveryService>.Instance);

        var recovered = await service.RecoverAbandonedRunsAsync(recoveredAt);

        Assert.Equal(1, recovered);

        var stale = await db.ScrapeRuns.FindAsync(staleId);
        var completed = await db.ScrapeRuns.FindAsync(completedId);

        Assert.NotNull(stale);
        Assert.Equal(ScrapeRunStatus.Abandoned, stale.Status);
        Assert.Equal(recoveredAt, stale.FinishedAt);
        Assert.NotNull(completed);
        Assert.Equal(ScrapeRunStatus.Success, completed.Status);
    }
}
