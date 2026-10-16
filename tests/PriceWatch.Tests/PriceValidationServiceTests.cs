using Microsoft.Extensions.Options;
using PriceWatch.Data.Entities;
using PriceWatch.Private;
using PriceWatch.Private.Services;

namespace PriceWatch.Tests;

public sealed class PriceValidationServiceTests
{
    [Fact]
    public async Task FirstObservationForNewSource_UsesCurrentAcceptedItemPriceAsBaseline()
    {
        await using var db = TestDb.Create();
        var item = new TrackedItem
        {
            Id = Guid.NewGuid(),
            Name = "Test item",
            Currency = "SEK",
            CurrentPrice = 100,
            CurrentQuantity = 1,
            CurrentSourceId = 1
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

        var service = new PriceValidationService(
            db,
            Options.Create(new PrivateSettings
            {
                SuspiciousChangeRatio = 0.80m
            }));

        var result = await service.ValidateAsync(
            item,
            source,
            price: 500,
            quantity: 1);

        Assert.Equal(ScrapeResultStatus.Suspicious, result.Status);
    }

    [Fact]
    public async Task FirstEverObservation_WithNoAcceptedBaseline_PassesBasicSanityCheck()
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

        var service = new PriceValidationService(
            db,
            Options.Create(new PrivateSettings
            {
                SuspiciousChangeRatio = 0.80m
            }));

        var result = await service.ValidateAsync(
            item,
            source,
            price: 10,
            quantity: 1);

        Assert.Equal(ScrapeResultStatus.Success, result.Status);
    }
}
