using Microsoft.EntityFrameworkCore;
using PriceWatch.Core.Services;
using PriceWatch.Data.Entities;

namespace PriceWatch.Tests;

public sealed class PriceTrackingServiceTests
{
    [Fact]
    public async Task Recalculate_UsesLatestAcceptedObservationPerActiveSource()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product", target: 100);
        var a = Source(item, 1, "A");
        var b = Source(item, 2, "B");

        db.AddRange(item, a, b);
        db.PriceObservations.AddRange(
            Observation(item, a, 80, now.AddHours(-2)),
            Observation(item, a, 90, now.AddHours(-1)),
            Observation(item, b, 85, now));
        await db.SaveChangesAsync();

        var service = new PriceTrackingService(db);
        var change = await service.RecalculateBestPriceAsync(
            item.Id,
            BestPriceChangeCause.Automatic,
            now);
        await db.SaveChangesAsync();

        Assert.True(change.StateChanged);
        Assert.Equal(85m, change.UnitPrice);
        Assert.Equal(new long[] { b.Id }, change.SourceIds);
        Assert.Equal(85m, item.CurrentPrice);
        Assert.Equal(now, item.LastSuccessfulPriceAt);
    }

    [Fact]
    public async Task Recalculate_RecordsStateWhenLowestStoreSetChangesAtSamePrice()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product");
        var a = Source(item, 1, "A");
        var b = Source(item, 2, "B");

        db.AddRange(item, a, b);
        db.PriceObservations.AddRange(
            Observation(item, a, 90, now.AddMinutes(-2)),
            Observation(item, b, 90, now.AddMinutes(-2)));
        await db.SaveChangesAsync();

        var service = new PriceTrackingService(db);
        await service.RecalculateBestPriceAsync(item.Id, BestPriceChangeCause.Automatic, now.AddMinutes(-2));
        await db.SaveChangesAsync();

        db.PriceObservations.Add(Observation(item, a, 95, now));
        await db.SaveChangesAsync();

        var change = await service.RecalculateBestPriceAsync(item.Id, BestPriceChangeCause.Automatic, now);
        await db.SaveChangesAsync();

        Assert.True(change.StateChanged);
        Assert.Equal(90m, change.UnitPrice);
        Assert.Equal(new long[] { b.Id }, change.SourceIds);
        Assert.Equal(2, await db.BestPriceStates.CountAsync());
    }

    [Fact]
    public async Task ManualChange_DoesNotQueueAlert_AutomaticChangeDoes()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product", target: 100);
        var source = Source(item, 1, "A");
        db.AddRange(item, source);
        db.PriceObservations.Add(Observation(item, source, 90, now.AddMinutes(-1), PriceOrigin.Manual));
        await db.SaveChangesAsync();

        var service = new PriceTrackingService(db);
        await service.RecalculateBestPriceAsync(item.Id, BestPriceChangeCause.Manual, now.AddMinutes(-1));
        await db.SaveChangesAsync();
        Assert.Empty(db.PriceAlertEvents);

        db.PriceObservations.Add(Observation(item, source, 80, now, PriceOrigin.Scrape));
        await db.SaveChangesAsync();
        await service.RecalculateBestPriceAsync(item.Id, BestPriceChangeCause.Automatic, now);
        await db.SaveChangesAsync();

        Assert.Single(db.PriceAlertEvents);
        Assert.Equal(AlertStatus.Pending, db.PriceAlertEvents.Single().Status);
    }

    [Fact]
    public async Task ArchivedSource_DoesNotParticipateInCurrentPrice()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product");
        var archived = Source(item, 1, "Old", archivedAt: now);
        var active = Source(item, 2, "Active");

        db.AddRange(item, archived, active);
        db.PriceObservations.AddRange(
            Observation(item, archived, 10, now.AddDays(-1)),
            Observation(item, active, 20, now));
        await db.SaveChangesAsync();

        var service = new PriceTrackingService(db);
        var change = await service.RecalculateBestPriceAsync(item.Id, BestPriceChangeCause.SourceChange, now);
        await db.SaveChangesAsync();

        Assert.Equal(20m, change.UnitPrice);
        Assert.Equal(new long[] { active.Id }, change.SourceIds);
    }


    [Fact]
    public async Task AutomaticStoreSetChangeAtSameBelowTargetPrice_QueuesAlert()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product", target: 100);
        var a = Source(item, 1, "A");
        var b = Source(item, 2, "B");

        db.AddRange(item, a, b);
        db.PriceObservations.AddRange(
            Observation(item, a, 90, now.AddMinutes(-2)),
            Observation(item, b, 95, now.AddMinutes(-2)));
        await db.SaveChangesAsync();

        var service = new PriceTrackingService(db);
        await service.RecalculateBestPriceAsync(
            item.Id,
            BestPriceChangeCause.Automatic,
            now.AddMinutes(-2));
        await db.SaveChangesAsync();
        db.PriceAlertEvents.RemoveRange(db.PriceAlertEvents);
        await db.SaveChangesAsync();

        db.PriceObservations.Add(Observation(item, b, 90, now));
        await db.SaveChangesAsync();

        var change = await service.RecalculateBestPriceAsync(
            item.Id,
            BestPriceChangeCause.Automatic,
            now);
        await db.SaveChangesAsync();

        Assert.True(change.StateChanged);
        Assert.Equal(new long[] { a.Id, b.Id }, change.SourceIds);
        Assert.True(change.AlertQueued);
        Assert.Single(db.PriceAlertEvents);
    }

    [Fact]
    public async Task EffectiveOffer_ReportsPendingReviewWithoutChangingLastKnownPrice()
    {
        await using var db = TestDb.Create();
        var now = DateTimeOffset.UtcNow;
        var item = Item("Product");
        var source = Source(item, 1, "A");

        db.AddRange(item, source);
        db.PriceObservations.Add(Observation(item, source, 90, now.AddMinutes(-5)));
        db.ScrapeResults.Add(new ScrapeResult
        {
            RunId = Guid.NewGuid(),
            ItemId = item.Id,
            SourceId = source.Id,
            ResultStatus = ScrapeResultStatus.Failed,
            ReviewStatus = ReviewStatus.Pending,
            ObservedAt = now,
            CreatedAt = now
        });
        await db.SaveChangesAsync();

        var offer = Assert.Single(await new PriceTrackingService(db)
            .GetEffectiveOffersAsync(item.Id));

        Assert.True(offer.HasPendingReview);
        Assert.Equal(90m, offer.UnitPrice);
    }

    private static TrackedItem Item(string name, decimal? target = null) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        Currency = "SEK",
        TargetPrice = target,
        ComparisonQuantity = 1
    };

    private static ItemSource Source(
        TrackedItem item,
        long id,
        string store,
        DateTimeOffset? archivedAt = null) => new()
    {
        Id = id,
        ItemId = item.Id,
        Item = item,
        Store = store,
        DefaultQuantity = 1,
        ArchivedAt = archivedAt,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow
    };

    private static PriceObservation Observation(
        TrackedItem item,
        ItemSource source,
        decimal price,
        DateTimeOffset observedAt,
        PriceOrigin origin = PriceOrigin.Scrape) => new()
    {
        ItemId = item.Id,
        Item = item,
        SourceId = source.Id,
        Source = source,
        Price = price,
        Quantity = 1,
        Origin = origin,
        ObservedAt = observedAt
    };
}
