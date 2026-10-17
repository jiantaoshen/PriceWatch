using Microsoft.Extensions.Options;
using PriceWatch.Data.Entities;
using PriceWatch.Private;
using PriceWatch.Private.Services;

namespace PriceWatch.Tests;

public sealed class PriceValidationServiceTests
{
    [Fact]
    public async Task UsesSameSourceLatestEffectivePriceAsPrimaryBaseline()
    {
        await using var db = TestDb.Create();
        var item = new TrackedItem
        {
            Id = Guid.NewGuid(),
            Name = "Test item",
            Currency = "SEK",
            CurrentPrice = 20,
            CurrentQuantity = 1
        };
        var source = new ItemSource
        {
            Id = 1,
            ItemId = item.Id,
            Item = item,
            Store = "Source",
            ScrapingEnabled = true,
            DefaultQuantity = 1
        };

        db.AddRange(item, source);
        db.PriceObservations.Add(new PriceObservation
        {
            ItemId = item.Id,
            Item = item,
            SourceId = source.Id,
            Source = source,
            Price = 100,
            Quantity = 1,
            Origin = PriceOrigin.Manual,
            ObservedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        await db.SaveChangesAsync();

        var service = Service(db);
        var result = await service.ValidateAsync(item, source, price: 150, quantity: 1);

        Assert.Equal(ScrapeResultStatus.Success, result.Status);
    }

    [Fact]
    public async Task NewSource_UsesProductCurrentPriceAsFallbackBaseline()
    {
        await using var db = TestDb.Create();
        var item = new TrackedItem
        {
            Id = Guid.NewGuid(),
            Name = "Test item",
            Currency = "SEK",
            CurrentPrice = 100,
            CurrentQuantity = 1
        };
        var source = new ItemSource
        {
            Id = 2,
            ItemId = item.Id,
            Item = item,
            Store = "New source",
            ScrapingEnabled = true,
            DefaultQuantity = 1
        };

        db.AddRange(item, source);
        await db.SaveChangesAsync();

        var result = await Service(db).ValidateAsync(item, source, price: 500, quantity: 1);
        Assert.Equal(ScrapeResultStatus.Suspicious, result.Status);
    }

    [Fact]
    public async Task FirstEverObservation_WithNoBaseline_PassesSanityValidation()
    {
        await using var db = TestDb.Create();
        var item = new TrackedItem
        {
            Id = Guid.NewGuid(),
            Name = "Test item",
            Currency = "SEK"
        };
        var source = new ItemSource
        {
            Id = 1,
            ItemId = item.Id,
            Item = item,
            Store = "First source",
            ScrapingEnabled = true,
            DefaultQuantity = 1
        };

        db.AddRange(item, source);
        await db.SaveChangesAsync();

        var result = await Service(db).ValidateAsync(item, source, price: 10, quantity: 1);
        Assert.Equal(ScrapeResultStatus.Success, result.Status);
    }

    private static PriceValidationService Service(PriceWatch.Data.PriceWatchDbContext db) =>
        new(db, Options.Create(new PrivateSettings { SuspiciousChangeRatio = 0.80m }));
}
