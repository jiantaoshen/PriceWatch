using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Core.Services;

public sealed class PriceUpdateService
{
    private readonly PriceWatchDbContext _db;

    public PriceUpdateService(PriceWatchDbContext db)
    {
        _db = db;
    }

    public async Task ApplyAcceptedPriceAsync(
        Guid itemId,
        decimal price,
        decimal quantity,
        PriceOrigin origin,
        long? sourceId = null,
        long? scrapeResultId = null,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0)
            throw new ArgumentOutOfRangeException(nameof(quantity));

        var item = await _db.TrackedItems
            .SingleAsync(
                x => x.Id == itemId,
                cancellationToken);

        var newUnitPrice = price / quantity;

        decimal? oldUnitPrice = null;

        if (
            item.CurrentPrice.HasValue &&
            item.CurrentQuantity.HasValue &&
            item.CurrentQuantity.Value > 0)
        {
            oldUnitPrice =
                item.CurrentPrice.Value /
                item.CurrentQuantity.Value;
        }

        var now = DateTimeOffset.UtcNow;


        // normalized price 没变：
        // 更新当前实际 offer，但不增加 history，
        // Previous 也不移动。
        if (oldUnitPrice == newUnitPrice)
        {
            item.CurrentPrice = price;
            item.CurrentQuantity = quantity;
            item.CurrentSourceId = sourceId;

            item.LastSuccessfulPriceAt = now;
            item.UpdatedAt = now;

            return;
        }


        // Previous <- Current
        item.PreviousPrice = item.CurrentPrice;
        item.PreviousQuantity = item.CurrentQuantity;
        item.PreviousSourceId = item.CurrentSourceId;


        // Current <- New
        item.CurrentPrice = price;
        item.CurrentQuantity = quantity;
        item.CurrentSourceId = sourceId;

        item.LastSuccessfulPriceAt = now;
        item.LastPriceChangedAt = now;
        item.UpdatedAt = now;


        _db.PriceHistory.Add(new PriceHistory
        {
            ItemId = itemId,

            SourceId = sourceId,

            ScrapeResultId = scrapeResultId,

            Price = price,

            Quantity = quantity,

            Origin = origin,

            RecordedAt = now
        });
    }
}