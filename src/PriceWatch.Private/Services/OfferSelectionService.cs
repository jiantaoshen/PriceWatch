using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Private.Services;

public sealed record AcceptedOfferCandidate(
    long SourceId,
    long? ScrapeResultId,
    decimal Price,
    decimal Quantity,
    decimal UnitPrice,
    PriceOrigin Origin,
    bool IsCurrentSource);

public sealed class OfferSelectionService
{
    private readonly PriceWatchDbContext _db;

    public OfferSelectionService(PriceWatchDbContext db)
    {
        _db = db;
    }

    public async Task<AcceptedOfferCandidate?> GetBestAcceptedOfferAsync(
        Guid itemId,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .AsNoTracking()
            .Where(x => x.Id == itemId)
            .Select(x => new
            {
                x.Id,
                x.CurrentSourceId
            })
            .SingleOrDefaultAsync(ct);

        if (item is null)
        {
            return null;
        }

        var sources = await _db.ItemSources
            .AsNoTracking()
            .Where(x => x.ItemId == itemId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        var candidates = new List<AcceptedOfferCandidate>();

        foreach (var source in sources)
        {
            if (
                !source.ScrapingEnabled &&
                source.ManualPrice.HasValue &&
                source.ManualPrice.Value >= 0 &&
                source.DefaultQuantity > 0)
            {
                candidates.Add(new AcceptedOfferCandidate(
                    source.Id,
                    null,
                    source.ManualPrice.Value,
                    source.DefaultQuantity,
                    source.ManualPrice.Value / source.DefaultQuantity,
                    PriceOrigin.Manual,
                    item.CurrentSourceId == source.Id));

                continue;
            }

            if (!source.ScrapingEnabled)
            {
                continue;
            }

            var result = await _db.ScrapeResults
                .AsNoTracking()
                .Where(x =>
                    x.ItemId == itemId &&
                    x.SourceId == source.Id &&
                    (
                        x.ReviewStatus == ReviewStatus.NotRequired ||
                        x.ReviewStatus == ReviewStatus.Accepted ||
                        x.ReviewStatus == ReviewStatus.ManualOverride
                    ))
                .OrderByDescending(x => x.ReviewedAt ?? x.CreatedAt)
                .Select(x => new
                {
                    x.Id,
                    x.ScrapedPrice,
                    x.ScrapedQuantity,
                    x.ManualPrice,
                    x.ManualQuantity,
                    x.ReviewStatus
                })
                .FirstOrDefaultAsync(ct);

            if (result is null)
            {
                continue;
            }

            decimal? price = null;
            decimal? quantity = null;
            var origin = PriceOrigin.Scrape;

            if (
                result.ReviewStatus == ReviewStatus.ManualOverride &&
                result.ManualPrice.HasValue &&
                result.ManualQuantity.HasValue)
            {
                price = result.ManualPrice.Value;
                quantity = result.ManualQuantity.Value;
                origin = PriceOrigin.ManualOverride;
            }
            else if (
                result.ScrapedPrice.HasValue &&
                result.ScrapedQuantity.HasValue)
            {
                price = result.ScrapedPrice.Value;
                quantity = result.ScrapedQuantity.Value;
            }

            if (
                !price.HasValue ||
                !quantity.HasValue ||
                price.Value < 0 ||
                quantity.Value <= 0)
            {
                continue;
            }

            candidates.Add(new AcceptedOfferCandidate(
                source.Id,
                result.Id,
                price.Value,
                quantity.Value,
                price.Value / quantity.Value,
                origin,
                item.CurrentSourceId == source.Id));
        }

        return candidates
            .OrderBy(x => x.UnitPrice)
            .ThenByDescending(x => x.IsCurrentSource)
            .ThenBy(x => x.SourceId)
            .FirstOrDefault();
    }
}
