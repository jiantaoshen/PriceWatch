using PriceWatch.Core.Services;
using PriceWatch.Data.Entities;

namespace PriceWatch.Tests;

public sealed class OfferSelectionServiceTests
{
    [Fact]
    public async Task BestOffer_UsesOnlyCurrentRun_AndLowestUnitPrice()
    {
        await using var db = TestDb.Create();
        var itemId = Guid.NewGuid();
        var oldRunId = Guid.NewGuid();
        var currentRunId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var item = new TrackedItem
        {
            Id = itemId,
            Name = "Test item",
            Currency = "SEK"
        };

        var sourceA = new ItemSource
        {
            Id = 1,
            ItemId = itemId,
            Item = item,
            Store = "A",
            ScrapingEnabled = true,
            DefaultQuantity = 1,
            CreatedAt = now,
            UpdatedAt = now
        };
        var sourceB = new ItemSource
        {
            Id = 2,
            ItemId = itemId,
            Item = item,
            Store = "B",
            ScrapingEnabled = true,
            DefaultQuantity = 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.AddRange(
            item,
            sourceA,
            sourceB,
            new ScrapeRun { Id = oldRunId, Status = ScrapeRunStatus.Success },
            new ScrapeRun { Id = currentRunId, Status = ScrapeRunStatus.Running },
            new ScrapeResult
            {
                Id = 1,
                RunId = oldRunId,
                ItemId = itemId,
                SourceId = sourceA.Id,
                ScrapedPrice = 1,
                ScrapedQuantity = 1,
                ResultStatus = ScrapeResultStatus.Success,
                ReviewStatus = ReviewStatus.NotRequired,
                CreatedAt = now.AddMinutes(-5)
            },
            new ScrapeResult
            {
                Id = 2,
                RunId = currentRunId,
                ItemId = itemId,
                SourceId = sourceA.Id,
                ScrapedPrice = 10,
                ScrapedQuantity = 1,
                ResultStatus = ScrapeResultStatus.Success,
                ReviewStatus = ReviewStatus.NotRequired,
                CreatedAt = now
            },
            new ScrapeResult
            {
                Id = 3,
                RunId = currentRunId,
                ItemId = itemId,
                SourceId = sourceB.Id,
                ScrapedPrice = 8,
                ScrapedQuantity = 1,
                ResultStatus = ScrapeResultStatus.Success,
                ReviewStatus = ReviewStatus.NotRequired,
                CreatedAt = now
            });

        await db.SaveChangesAsync();

        var service = new OfferSelectionService(db);
        var best = await service.GetBestAcceptedOfferAsync(itemId, currentRunId);

        Assert.False(await service.IsLatestRunForItemAsync(itemId, oldRunId));
        Assert.True(await service.IsLatestRunForItemAsync(itemId, currentRunId));
        Assert.NotNull(best);
        Assert.Equal(sourceB.Id, best.SourceId);
        Assert.Equal(8m, best.Price);
        Assert.Equal(8m, best.UnitPrice);
    }
}
