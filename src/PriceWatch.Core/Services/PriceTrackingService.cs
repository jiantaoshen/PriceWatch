using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Core.Services;

public sealed record EffectiveSourceOffer(
    long SourceId,
    string Store,
    string? Url,
    string? Note,
    bool ScrapingEnabled,
    decimal DefaultQuantity,
    decimal? Price,
    decimal? Quantity,
    decimal? UnitPrice,
    PriceOrigin? Origin,
    DateTimeOffset? ObservedAt,
    bool HasPendingReview,
    bool IsBest);

public sealed record BestPriceChange(
    bool StateChanged,
    decimal? UnitPrice,
    IReadOnlyList<long> SourceIds,
    bool AlertQueued);

public sealed class PriceTrackingService
{
    private readonly PriceWatchDbContext _db;

    public PriceTrackingService(PriceWatchDbContext db)
    {
        _db = db;
    }

    public PriceObservation AddObservation(
        Guid itemId,
        long sourceId,
        decimal price,
        decimal quantity,
        PriceOrigin origin,
        DateTimeOffset observedAt,
        long? scrapeResultId = null)
    {
        if (price < 0)
            throw new ArgumentOutOfRangeException(nameof(price));

        if (quantity <= 0)
            throw new ArgumentOutOfRangeException(nameof(quantity));

        var observation = new PriceObservation
        {
            ItemId = itemId,
            SourceId = sourceId,
            ScrapeResultId = scrapeResultId,
            Price = price,
            Quantity = quantity,
            Origin = origin,
            ObservedAt = observedAt
        };

        _db.PriceObservations.Add(observation);
        return observation;
    }

    public async Task<IReadOnlyList<EffectiveSourceOffer>> GetEffectiveOffersAsync(
        Guid itemId,
        bool includeArchived = false,
        CancellationToken ct = default)
    {
        var sourcesQuery = _db.ItemSources
            .AsNoTracking()
            .Where(x => x.ItemId == itemId);

        if (!includeArchived)
        {
            sourcesQuery = sourcesQuery.Where(x => x.ArchivedAt == null);
        }

        var sources = await sourcesQuery
            .OrderBy(x => x.Store)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);

        if (sources.Count == 0)
        {
            return [];
        }

        var sourceIds = sources.Select(x => x.Id).ToArray();

        var pendingSourceIds = await _db.ScrapeResults
            .AsNoTracking()
            .Where(x =>
                sourceIds.Contains(x.SourceId) &&
                x.ReviewStatus == ReviewStatus.Pending)
            .Select(x => x.SourceId)
            .Distinct()
            .ToListAsync(ct);
        var pendingSet = pendingSourceIds.ToHashSet();

        var observations = await _db.PriceObservations
            .AsNoTracking()
            .Where(x => x.ItemId == itemId && sourceIds.Contains(x.SourceId))
            .OrderByDescending(x => x.ObservedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.SourceId,
                x.Price,
                x.Quantity,
                x.Origin,
                x.ObservedAt
            })
            .ToListAsync(ct);

        var latestBySource = observations
            .GroupBy(x => x.SourceId)
            .ToDictionary(group => group.Key, group => group.First());

        var unitPrices = sources
            .Select(source => latestBySource.TryGetValue(source.Id, out var observation)
                ? observation.Price / observation.Quantity
                : (decimal?)null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToList();

        var bestUnitPrice = unitPrices.Count > 0 ? unitPrices.Min() : (decimal?)null;

        return sources
            .Select(source =>
            {
                if (!latestBySource.TryGetValue(source.Id, out var observation))
                {
                    return new EffectiveSourceOffer(
                        source.Id,
                        source.Store,
                        source.Url,
                        source.Note,
                        source.ScrapingEnabled,
                        source.DefaultQuantity,
                        null,
                        null,
                        null,
                        null,
                        null,
                        pendingSet.Contains(source.Id),
                        false);
                }

                var unitPrice = observation.Price / observation.Quantity;

                return new EffectiveSourceOffer(
                    source.Id,
                    source.Store,
                    source.Url,
                    source.Note,
                    source.ScrapingEnabled,
                    source.DefaultQuantity,
                    observation.Price,
                    observation.Quantity,
                    unitPrice,
                    observation.Origin,
                    observation.ObservedAt,
                    pendingSet.Contains(source.Id),
                    bestUnitPrice.HasValue && unitPrice == bestUnitPrice.Value);
            })
            .ToList();
    }

    public async Task<BestPriceChange> RecalculateBestPriceAsync(
        Guid itemId,
        BestPriceChangeCause cause,
        DateTimeOffset stateAt,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .SingleAsync(x => x.Id == itemId, ct);

        var offers = await GetEffectiveOffersAsync(itemId, false, ct);
        var pricedOffers = offers
            .Where(x => x.UnitPrice.HasValue && x.Price.HasValue && x.Quantity.HasValue)
            .ToList();

        if (pricedOffers.Count == 0)
        {
            var oldUnitPrice = CurrentUnitPrice(item);

            if (oldUnitPrice.HasValue)
            {
                item.PreviousPrice = item.CurrentPrice;
                item.PreviousQuantity = item.CurrentQuantity;
                item.LastPriceChangedAt = stateAt;
            }

            item.CurrentPrice = null;
            item.CurrentQuantity = null;
            item.UpdatedAt = DateTimeOffset.UtcNow;

            return new BestPriceChange(false, null, [], false);
        }

        var bestUnitPrice = pricedOffers.Min(x => x.UnitPrice!.Value);
        var bestOffers = pricedOffers
            .Where(x => x.UnitPrice == bestUnitPrice)
            .OrderBy(x => x.SourceId)
            .ToList();

        var representative = bestOffers[0];
        var oldUnit = CurrentUnitPrice(item);

        if (oldUnit != bestUnitPrice)
        {
            item.PreviousPrice = item.CurrentPrice;
            item.PreviousQuantity = item.CurrentQuantity;
            item.LastPriceChangedAt = stateAt;
        }

        item.CurrentPrice = representative.Price;
        item.CurrentQuantity = representative.Quantity;
        item.LastSuccessfulPriceAt = bestOffers
            .Where(x => x.ObservedAt.HasValue)
            .Select(x => x.ObservedAt!.Value)
            .DefaultIfEmpty(item.LastSuccessfulPriceAt ?? stateAt)
            .Max();
        item.UpdatedAt = DateTimeOffset.UtcNow;

        var latestState = await _db.BestPriceStates
            .AsNoTracking()
            .Include(x => x.Sources)
            .Where(x => x.ItemId == itemId)
            .OrderByDescending(x => x.RecordedAt)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        var bestSourceIds = bestOffers.Select(x => x.SourceId).ToArray();
        var previousSourceIds = latestState?.Sources
            .Select(x => x.SourceId)
            .OrderBy(x => x)
            .ToArray() ?? [];

        var stateChanged = latestState is null ||
            latestState.UnitPrice != bestUnitPrice ||
            !previousSourceIds.SequenceEqual(bestSourceIds);

        if (!stateChanged)
        {
            return new BestPriceChange(
                false,
                bestUnitPrice,
                bestSourceIds,
                false);
        }

        var state = new BestPriceState
        {
            ItemId = itemId,
            UnitPrice = bestUnitPrice,
            Cause = cause,
            RecordedAt = stateAt,
            Sources = bestSourceIds
                .Select(sourceId => new BestPriceStateSource
                {
                    ItemId = itemId,
                    SourceId = sourceId
                })
                .ToList()
        };

        _db.BestPriceStates.Add(state);

        var alertQueued = false;
        var targetUnitPrice = item.TargetPrice.HasValue && item.ComparisonQuantity > 0
            ? item.TargetPrice.Value / item.ComparisonQuantity
            : (decimal?)null;

        if (cause == BestPriceChangeCause.Automatic &&
            targetUnitPrice.HasValue &&
            bestUnitPrice <= targetUnitPrice.Value)
        {
            _db.PriceAlertEvents.Add(new PriceAlertEvent
            {
                ItemId = itemId,
                BestPriceState = state,
                UnitPrice = bestUnitPrice,
                TargetUnitPrice = targetUnitPrice.Value,
                Status = AlertStatus.Pending,
                CreatedAt = DateTimeOffset.UtcNow
            });

            alertQueued = true;
        }

        return new BestPriceChange(
            true,
            bestUnitPrice,
            bestSourceIds,
            alertQueued);
    }

    private static decimal? CurrentUnitPrice(TrackedItem item)
    {
        if (!item.CurrentPrice.HasValue ||
            !item.CurrentQuantity.HasValue ||
            item.CurrentQuantity.Value <= 0)
        {
            return null;
        }

        return item.CurrentPrice.Value / item.CurrentQuantity.Value;
    }
}
