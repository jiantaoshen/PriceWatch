using PriceWatch.Core.Services;
using PriceWatch.Data.Entities;

namespace PriceWatch.Tests;

public sealed class PriceUpdateServiceTests
{
    [Fact]
    public async Task ApplyAcceptedPrice_UsesObservationTimeForLastSuccessfulPrice()
    {
        await using var db = TestDb.Create();
        var item = new TrackedItem
        {
            Id = Guid.NewGuid(),
            Name = "Test item",
            Currency = "SEK"
        };
        db.TrackedItems.Add(item);
        await db.SaveChangesAsync();

        var observedAt = DateTimeOffset.UtcNow.AddMinutes(-10);
        var service = new PriceUpdateService(db);

        await service.ApplyAcceptedPriceAsync(
            item.Id,
            price: 20,
            quantity: 2,
            origin: PriceOrigin.Scrape,
            observedAt: observedAt);
        await db.SaveChangesAsync();

        Assert.Equal(observedAt, item.LastSuccessfulPriceAt);
        Assert.Equal(20m, item.CurrentPrice);
        Assert.Equal(2m, item.CurrentQuantity);
    }
}
