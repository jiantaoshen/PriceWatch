using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Migrator;

internal sealed class LegacyImporter
{
    private readonly PriceWatchDbContext _db;

    public LegacyImporter(
        PriceWatchDbContext db)
    {
        _db = db;
    }

    public async Task<ImportResult> ImportAsync(
        string zipPath,
        bool apply,
        CancellationToken ct = default)
    {
        var bundle =
            LegacyBundle.Load(zipPath);

        var result =
            new ImportResult();

        if (bundle.Schedule is not null)
        {
            result.Warnings.Add(
                "data/settings/schedule.json was intentionally NOT uploaded. " +
                "The schedule is private/local scraper configuration, not cloud data.");
        }

        result.Warnings.Add(
            "data/history/index.json is an index file only; the actual history JSON files were imported.");

        result.Warnings.Add(
            "data/runs/latest.json duplicates one of the dated run files; it was not imported twice.");

        await using var transaction =
            await _db.Database
                .BeginTransactionAsync(ct);

        var itemMap =
            new Dictionary<string, TrackedItem>(
                StringComparer.OrdinalIgnoreCase);

        var sourceMap =
            new Dictionary<
                string,
                Dictionary<string, ItemSource>>(
                StringComparer.OrdinalIgnoreCase);

        var allLegacyItems =
            bundle.Products
                .Select(x =>
                    (Item: x,
                     Type: ItemType.Product))
                .Concat(
                    bundle.Subscriptions
                        .Select(x =>
                            (Item: x,
                             Type: ItemType.Subscription)))
                .ToList();

        result.Subscriptions =
            bundle.Subscriptions.Count;

        var earliestObserved =
            bundle.History
                .Select(x =>
                    (DateTimeOffset?)x.GeneratedAt)
                .Concat(
                    bundle.Runs
                        .Select(x =>
                            (DateTimeOffset?)x.StartedAt))
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .DefaultIfEmpty(
                    bundle.Latest.GeneratedAt)
                .Min();

        // ----------------------------------------------------
        // 1. Items
        // ----------------------------------------------------
        foreach (var entry in allLegacyItems)
        {
            var legacy =
                entry.Item;

            var deterministicId =
                LegacyIds.ForItem(
                    legacy.Id);

            var item =
                await _db.TrackedItems
                    .SingleOrDefaultAsync(
                        x =>
                            x.Id ==
                            deterministicId,
                        ct);

            if (item is null)
            {
                var sameName =
                    await _db.TrackedItems
                        .Where(x =>
                            x.Name ==
                            legacy.Name)
                        .Take(2)
                        .ToListAsync(ct);

                if (sameName.Count > 1)
                {
                    throw new InvalidOperationException(
                        $"More than one existing item has the name '{legacy.Name}'. " +
                        "Clean duplicates before running the legacy importer.");
                }

                item =
                    sameName.SingleOrDefault();
            }

            var isNew =
                item is null;

            if (item is null)
            {
                item =
                    new TrackedItem
                    {
                        Id =
                            deterministicId,

                        CreatedAt =
                            earliestObserved
                    };

                _db.TrackedItems.Add(item);
            }

            var comparisonQuantity =
                legacy.ComparisonQuantity
                is > 0
                    ? legacy.ComparisonQuantity.Value
                    : 1m;

            item.ItemType =
                entry.Type;

            item.Name =
                legacy.Name.Trim();

            item.Currency =
                string.IsNullOrWhiteSpace(
                    legacy.Currency)
                    ? "SEK"
                    : legacy.Currency
                        .Trim()
                        .ToUpperInvariant();

            item.Unit =
                Normalize(
                    legacy.Unit);

            item.TargetPrice =
                legacy.TargetPrice;

            item.ComparisonQuantity =
                comparisonQuantity;

            item.LastPurchasePrice =
                legacy.LastPurchasePrice;

            item.LastPurchaseDate =
                ParseDateOnly(
                    legacy.LastPurchaseDate);

            item.UpdateMode =
                DetermineUpdateMode(
                    legacy);

            item.CheckIntervalMinutes =
                null;

            item.TrackingEnabled =
                legacy.ScrapingEnabled
                &&
                string.IsNullOrWhiteSpace(
                    legacy.ArchivedAt);

            item.ArchivedAt =
                ParseDateTimeOffset(
                    legacy.ArchivedAt);

            item.UpdatedAt =
                bundle.Latest.GeneratedAt;

            itemMap[legacy.Id] =
                item;

            result.Items++;

            Console.WriteLine(
                $"{(isNew ? "CREATE" : "UPDATE")} item: {legacy.Name}");
        }

        await _db.SaveChangesAsync(ct);

        // ----------------------------------------------------
        // 2. Sources
        // ----------------------------------------------------
        foreach (var entry in allLegacyItems)
        {
            var legacy =
                entry.Item;

            var item =
                itemMap[legacy.Id];

            var perItemMap =
                new Dictionary<
                    string,
                    ItemSource>(
                    StringComparer.OrdinalIgnoreCase);

            sourceMap[legacy.Id] =
                perItemMap;

            foreach (var source in legacy.Sources)
            {
                var store =
                    source.Store.Trim();

                var url =
                    Normalize(source.Url);

                var existing =
                    await _db.ItemSources
                        .Where(x =>
                            x.ItemId ==
                                item.Id
                            &&
                            x.Store ==
                                store)
                        .OrderBy(x => x.Id)
                        .ToListAsync(ct);

                ItemSource? entity =
                    null;

                if (url is not null)
                {
                    entity =
                        existing
                            .FirstOrDefault(
                                x =>
                                    string.Equals(
                                        x.Url,
                                        url,
                                        StringComparison.OrdinalIgnoreCase));
                }

                entity ??=
                    existing.Count == 1
                        ? existing[0]
                        : null;

                var isNew =
                    entity is null;

                if (entity is null)
                {
                    entity =
                        new ItemSource
                        {
                            ItemId =
                                item.Id,

                            CreatedAt =
                                earliestObserved
                        };

                    _db.ItemSources.Add(
                        entity);
                }

                entity.Store =
                    store;

                entity.Url =
                    url;

                entity.ScrapingEnabled =
                    source.ScrapingEnabled;

                entity.DefaultQuantity =
                    source.UnitQuantity
                    is > 0
                        ? source.UnitQuantity.Value
                        : 1m;

                entity.ManualPrice =
                    source.ManualPrice;

                entity.Note =
                    Normalize(
                        source.Note);

                entity.UpdatedAt =
                    bundle.Latest.GeneratedAt;

                await _db.SaveChangesAsync(
                    ct);

                perItemMap[
                    SourceKey(
                        source.Store,
                        source.Url)] =
                    entity;

                result.Sources++;

                Console.WriteLine(
                    $"  {(isNew ? "CREATE" : "UPDATE")} source: {source.Store}");
            }
        }

        // ----------------------------------------------------
        // 3. Scrape run summaries
        // ----------------------------------------------------
        foreach (var legacyRun in bundle.Runs)
        {
            var runId =
                LegacyIds.ForRun(
                    legacyRun.RunId);

            var run =
                await _db.ScrapeRuns
                    .SingleOrDefaultAsync(
                        x => x.Id == runId,
                        ct);

            if (run is null)
            {
                run =
                    new ScrapeRun
                    {
                        Id = runId
                    };

                _db.ScrapeRuns.Add(
                    run);
            }

            run.StartedAt =
                legacyRun.StartedAt;

            run.FinishedAt =
                legacyRun.FinishedAt;

            run.Status =
                MapRunStatus(
                    legacyRun.Status);

            run.TotalItems =
                legacyRun.TotalProducts;

            run.Successful =
                legacyRun.Successful;

            run.Failed =
                legacyRun.Failed;

            run.Suspicious =
                legacyRun.Suspicious;

            result.Runs++;
        }

        await _db.SaveChangesAsync(ct);

        // ----------------------------------------------------
        // 4. Accepted historical price changes
        //
        // Legacy weekly history was snapshot-based. The new
        // schema stores only distinct accepted normalized
        // price changes, so repeated equal snapshots are
        // intentionally collapsed.
        // ----------------------------------------------------
        foreach (var entry in allLegacyItems)
        {
            var legacy =
                entry.Item;

            var item =
                itemMap[legacy.Id];

            var historical =
                BuildDistinctHistory(
                    legacy,
                    bundle.History);

            foreach (var point in historical)
            {
                var inferredSource =
                    InferHistoricalSource(
                        legacy,
                        point.UnitPrice,
                        sourceMap[
                            legacy.Id]);

                var origin =
                    inferredSource is not null
                    &&
                    !inferredSource.ScrapingEnabled
                    &&
                    inferredSource.ManualPrice.HasValue
                        ? PriceOrigin.Manual
                        : PriceOrigin.Scrape;

                var exists =
                    await _db.PriceHistory
                        .AsNoTracking()
                        .AnyAsync(
                            x =>
                                x.ItemId ==
                                    item.Id
                                &&
                                x.RecordedAt ==
                                    point.RecordedAt,
                            ct);

                if (exists)
                {
                    continue;
                }

                _db.PriceHistory.Add(
                    new PriceHistory
                    {
                        ItemId =
                            item.Id,

                        SourceId =
                            inferredSource?.Id,

                        ScrapeResultId =
                            null,

                        Price =
                            point.Price,

                        Quantity =
                            point.Quantity,

                        Origin =
                            origin,

                        RecordedAt =
                            point.RecordedAt
                    });

                result.HistoryRows++;
            }

            await _db.SaveChangesAsync(ct);
        }

        // ----------------------------------------------------
        // 5. Current / Previous snapshots
        // ----------------------------------------------------
        foreach (var entry in allLegacyItems)
        {
            var legacy =
                entry.Item;

            var item =
                itemMap[legacy.Id];

            var latest =
                bundle.Latest.Data
                    .SingleOrDefault(
                        x =>
                            string.Equals(
                                x.ProductId,
                                legacy.Id,
                                StringComparison.OrdinalIgnoreCase));

            if (latest is null)
            {
                continue;
            }

            var current =
                ResolveCurrentOffer(
                    legacy,
                    latest,
                    sourceMap[legacy.Id]);

            if (current is not null)
            {
                item.CurrentPrice =
                    current.Price;

                item.CurrentQuantity =
                    current.Quantity;

                item.CurrentSourceId =
                    current.Source?.Id;
            }
            else if (
                latest.CurrentPrice.HasValue)
            {
                item.CurrentPrice =
                    latest.CurrentPrice.Value;

                item.CurrentQuantity =
                    legacy.ComparisonQuantity
                    is > 0
                        ? legacy.ComparisonQuantity.Value
                        : 1m;

                item.CurrentSourceId =
                    FindSource(
                        sourceMap[legacy.Id],
                        latest.Store,
                        latest.Url)?.Id;
            }

            var currentUnitPrice =
                GetUnitPrice(
                    item.CurrentPrice,
                    item.CurrentQuantity);

            var history =
                BuildDistinctHistory(
                    legacy,
                    bundle.History);

            var previous =
                history
                    .AsEnumerable()
                    .Reverse()
                    .FirstOrDefault(
                        point =>
                            !currentUnitPrice.HasValue
                            ||
                            !DecimalHelpers.Equal(
                                point.UnitPrice,
                                currentUnitPrice.Value));

            if (previous is not null)
            {
                item.PreviousPrice =
                    previous.Price;

                item.PreviousQuantity =
                    previous.Quantity;

                item.PreviousSourceId =
                    InferHistoricalSource(
                        legacy,
                        previous.UnitPrice,
                        sourceMap[
                            legacy.Id])?.Id;
            }
            else
            {
                item.PreviousPrice =
                    null;

                item.PreviousQuantity =
                    null;

                item.PreviousSourceId =
                    null;
            }

            item.LastCheckedAt =
                bundle.Latest.GeneratedAt;

            if (string.Equals(
                    latest.Status,
                    "success",
                    StringComparison.OrdinalIgnoreCase))
            {
                item.LastSuccessfulPriceAt =
                    bundle.Latest.GeneratedAt;
            }

            item.LastPriceChangedAt =
                history.Count > 1
                    ? history[^1]
                        .RecordedAt
                    : null;

            item.UpdatedAt =
                bundle.Latest.GeneratedAt;
        }

        await _db.SaveChangesAsync(ct);

        // ----------------------------------------------------
        // 6. Latest per-source automatic scrape results
        //
        // The legacy run files contain only run summaries, so
        // historical per-source ScrapeResults cannot be
        // reconstructed safely. data/latest.json DOES contain
        // the latest offer list, so those latest automatic
        // offers can be imported without fabrication.
        // ----------------------------------------------------
        var latestRunId =
            FindLatestRunId(
                bundle);

        if (latestRunId.HasValue)
        {
            foreach (var latest in bundle.Latest.Data)
            {
                if (!itemMap.TryGetValue(
                        latest.ProductId,
                        out var item))
                {
                    continue;
                }

                var legacyProduct =
                    allLegacyItems
                        .Select(x => x.Item)
                        .Single(
                            x =>
                                string.Equals(
                                    x.Id,
                                    latest.ProductId,
                                    StringComparison.OrdinalIgnoreCase));

                foreach (var offer in latest.Offers)
                {
                    if (!string.Equals(
                            offer.PriceSource,
                            "scrape",
                            StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (!offer.Price.HasValue)
                    {
                        continue;
                    }

                    var source =
                        FindSource(
                            sourceMap[
                                latest.ProductId],
                            offer.Store,
                            offer.Url);

                    if (source is null)
                    {
                        result.Warnings.Add(
                            $"Latest offer source not found for '{latest.Name}' / '{offer.Store}'.");
                        continue;
                    }

                    var quantity =
                        offer.UnitQuantity
                        is > 0
                            ? offer.UnitQuantity.Value
                            : source.DefaultQuantity > 0
                                ? source.DefaultQuantity
                                : 1m;

                    var existing =
                        await _db.ScrapeResults
                            .SingleOrDefaultAsync(
                                x =>
                                    x.RunId ==
                                        latestRunId.Value
                                    &&
                                    x.ItemId ==
                                        item.Id
                                    &&
                                    x.SourceId ==
                                        source.Id
                                    &&
                                    x.CreatedAt ==
                                        bundle.Latest.GeneratedAt,
                                ct);

                    var scrapeResult =
                        existing
                        ?? new ScrapeResult
                        {
                            RunId =
                                latestRunId.Value,

                            ItemId =
                                item.Id,

                            SourceId =
                                source.Id,

                            CreatedAt =
                                bundle.Latest.GeneratedAt
                        };

                    scrapeResult.ScrapedPrice =
                        offer.Price.Value;

                    scrapeResult.ScrapedQuantity =
                        quantity;

                    scrapeResult.ResultStatus =
                        MapResultStatus(
                            latest.Status);

                    scrapeResult.Error =
                        latest.Error;

                    scrapeResult.SuspiciousReason =
                        string.Equals(
                            latest.Status,
                            "suspicious",
                            StringComparison.OrdinalIgnoreCase)
                            ? latest.Error
                            : null;

                    scrapeResult.ReviewStatus =
                        MapReviewStatus(
                            latest);

                    scrapeResult.ReviewedAt =
                        latest.ReviewedAt;

                    if (existing is null)
                    {
                        _db.ScrapeResults.Add(
                            scrapeResult);
                    }

                    result.ScrapeResults++;
                }
            }

            await _db.SaveChangesAsync(ct);
        }
        else
        {
            result.Warnings.Add(
                "Could not match data/latest.json to a ScrapeRun; latest per-source ScrapeResults were not imported.");
        }

        if (apply)
        {
            await transaction
                .CommitAsync(ct);
        }
        else
        {
            await transaction
                .RollbackAsync(ct);
        }

        return result;
    }

    private static UpdateMode DetermineUpdateMode(
        LegacyProduct product)
    {
        var hasAutomatic =
            product.Sources.Any(
                x =>
                    x.ScrapingEnabled);

        var hasManual =
            product.Sources.Any(
                x =>
                    !x.ScrapingEnabled
                    &&
                    x.ManualPrice.HasValue);

        if (hasAutomatic && hasManual)
        {
            return UpdateMode.Hybrid;
        }

        if (hasAutomatic)
        {
            return UpdateMode.Automatic;
        }

        return UpdateMode.Manual;
    }

    private static List<HistoryPoint>
        BuildDistinctHistory(
            LegacyProduct product,
            IReadOnlyList<LegacyHistoryFile> files)
    {
        var result =
            new List<HistoryPoint>();

        decimal? previousUnit =
            null;

        var comparisonQuantity =
            product.ComparisonQuantity
            is > 0
                ? product.ComparisonQuantity.Value
                : 1m;

        foreach (var file in files
                     .OrderBy(x =>
                         x.GeneratedAt))
        {
            var row =
                file.Data
                    .SingleOrDefault(
                        x =>
                            string.Equals(
                                x.ProductId,
                                product.Id,
                                StringComparison.OrdinalIgnoreCase));

            if (row?.CurrentPrice is null)
            {
                continue;
            }

            var price =
                row.CurrentPrice.Value;

            var quantity =
                comparisonQuantity;

            var calculatedUnit =
                price / quantity;

            var unitPrice =
                row.CurrentUnitPrice
                ?? calculatedUnit;

            // If legacy normalized price and comparable total
            // do not mathematically agree, preserve the
            // normalized value because that is the new model's
            // primary historical metric.
            if (
                row.CurrentUnitPrice.HasValue
                &&
                !DecimalHelpers.Equal(
                    calculatedUnit,
                    row.CurrentUnitPrice.Value))
            {
                price =
                    row.CurrentUnitPrice.Value;

                quantity =
                    1m;

                unitPrice =
                    row.CurrentUnitPrice.Value;
            }

            if (
                previousUnit.HasValue
                &&
                DecimalHelpers.Equal(
                    previousUnit.Value,
                    unitPrice))
            {
                continue;
            }

            result.Add(
                new HistoryPoint(
                    file.GeneratedAt,
                    price,
                    quantity,
                    unitPrice));

            previousUnit =
                unitPrice;
        }

        return result;
    }

    private static ResolvedOffer? ResolveCurrentOffer(
        LegacyProduct product,
        LegacyLatestItem latest,
        IReadOnlyDictionary<string, ItemSource> sources)
    {
        if (latest.Offers.Count == 0)
        {
            return null;
        }

        LegacyOffer? winner =
            null;

        if (!string.IsNullOrWhiteSpace(
                latest.Store))
        {
            winner =
                latest.Offers
                    .FirstOrDefault(
                        x =>
                            string.Equals(
                                x.Store,
                                latest.Store,
                                StringComparison.OrdinalIgnoreCase)
                            &&
                            (
                                string.IsNullOrWhiteSpace(
                                    latest.Url)
                                ||
                                string.Equals(
                                    Normalize(x.Url),
                                    Normalize(latest.Url),
                                    StringComparison.OrdinalIgnoreCase)
                            ));
        }

        winner ??=
            latest.Offers
                .Where(x =>
                    x.Price.HasValue)
                .OrderBy(
                    EffectiveUnitPrice)
                .FirstOrDefault();

        if (winner?.Price is null)
        {
            return null;
        }

        var source =
            FindSource(
                sources,
                winner.Store,
                winner.Url);

        var quantity =
            winner.UnitQuantity
            is > 0
                ? winner.UnitQuantity.Value
                : source?.DefaultQuantity
                    is > 0
                        ? source.DefaultQuantity
                        : 1m;

        return new ResolvedOffer(
            winner.Price.Value,
            quantity,
            source);
    }

    private static decimal EffectiveUnitPrice(
        LegacyOffer offer)
    {
        if (offer.UnitPrice.HasValue)
        {
            return offer.UnitPrice.Value;
        }

        if (!offer.Price.HasValue)
        {
            return decimal.MaxValue;
        }

        var quantity =
            offer.UnitQuantity
            is > 0
                ? offer.UnitQuantity.Value
                : 1m;

        return offer.Price.Value / quantity;
    }

    private static ItemSource?
        InferHistoricalSource(
            LegacyProduct product,
            decimal unitPrice,
            IReadOnlyDictionary<string, ItemSource> sources)
    {
        // A manual legacy source has a stable explicit
        // price/quantity, so exact unit-price matching is
        // strong evidence that it was the winner.
        foreach (var source in sources.Values)
        {
            if (
                !source.ScrapingEnabled
                &&
                source.ManualPrice.HasValue
                &&
                source.DefaultQuantity > 0)
            {
                var manualUnit =
                    source.ManualPrice.Value
                    /
                    source.DefaultQuantity;

                if (DecimalHelpers.Equal(
                        manualUnit,
                        unitPrice))
                {
                    return source;
                }
            }
        }

        var automatic =
            sources.Values
                .Where(x =>
                    x.ScrapingEnabled)
                .ToList();

        if (automatic.Count == 1)
        {
            return automatic[0];
        }

        if (sources.Count == 1)
        {
            return sources.Values.First();
        }

        return null;
    }

    private static ItemSource? FindSource(
        IReadOnlyDictionary<string, ItemSource> sources,
        string? store,
        string? url)
    {
        if (
            string.IsNullOrWhiteSpace(store)
            &&
            string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var key =
            SourceKey(
                store ?? string.Empty,
                url);

        if (sources.TryGetValue(
                key,
                out var exact))
        {
            return exact;
        }

        var byStore =
            sources.Values
                .Where(x =>
                    string.Equals(
                        x.Store,
                        store,
                        StringComparison.OrdinalIgnoreCase))
                .ToList();

        return byStore.Count == 1
            ? byStore[0]
            : null;
    }

    private static Guid? FindLatestRunId(
        LegacyBundle bundle)
    {
        var best =
            bundle.Runs
                .OrderBy(x =>
                    Math.Abs(
                        (
                            x.StartedAt
                            -
                            bundle.Latest.GeneratedAt
                        ).TotalMinutes))
                .FirstOrDefault();

        if (best is null)
        {
            return null;
        }

        // latest.json was generated when the latest scrape run
        // started in this legacy dataset. Refuse a wildly
        // different match instead of fabricating linkage.
        var difference =
            Math.Abs(
                (
                    best.StartedAt
                    -
                    bundle.Latest.GeneratedAt
                ).TotalMinutes);

        return difference <= 10
            ? LegacyIds.ForRun(
                best.RunId)
            : null;
    }

    private static ScrapeRunStatus MapRunStatus(
        string status)
    {
        return status.Trim().ToLowerInvariant()
            switch
            {
                "success" =>
                    ScrapeRunStatus.Success,

                "failed" =>
                    ScrapeRunStatus.Failed,

                "degraded" =>
                    ScrapeRunStatus.Partial,

                "partial" =>
                    ScrapeRunStatus.Partial,

                _ =>
                    ScrapeRunStatus.Partial
            };
    }

    private static ScrapeResultStatus
        MapResultStatus(
            string status)
    {
        return status.Trim().ToLowerInvariant()
            switch
            {
                "success" =>
                    ScrapeResultStatus.Success,

                "suspicious" =>
                    ScrapeResultStatus.Suspicious,

                "failed" =>
                    ScrapeResultStatus.Failed,

                "error" =>
                    ScrapeResultStatus.Failed,

                _ =>
                    ScrapeResultStatus.Success
            };
    }

    private static ReviewStatus MapReviewStatus(
        LegacyLatestItem item)
    {
        if (!item.ReviewedByUser)
        {
            return item.Status.Trim()
                       .Equals(
                           "success",
                           StringComparison.OrdinalIgnoreCase)
                ? ReviewStatus.NotRequired
                : ReviewStatus.Pending;
        }

        var method =
            item.ReviewMethod?
                .Trim()
                .ToLowerInvariant();

        if (method?.Contains(
                "reject") == true)
        {
            return ReviewStatus.Rejected;
        }

        if (method?.Contains(
                "manual") == true)
        {
            return ReviewStatus.ManualOverride;
        }

        return ReviewStatus.Accepted;
    }

    private static string SourceKey(
        string store,
        string? url)
    {
        return
            $"{store.Trim().ToLowerInvariant()}|{Normalize(url)?.ToLowerInvariant() ?? string.Empty}";
    }

    private static string? Normalize(
        string? value)
    {
        return string.IsNullOrWhiteSpace(
            value)
            ? null
            : value.Trim();
    }

    private static DateOnly? ParseDateOnly(
        string? value)
    {
        return DateOnly.TryParse(
            value,
            out var parsed)
            ? parsed
            : null;
    }

    private static DateTimeOffset?
        ParseDateTimeOffset(
            string? value)
    {
        return DateTimeOffset.TryParse(
            value,
            out var parsed)
            ? parsed.ToUniversalTime()
            : null;
    }

    private static decimal? GetUnitPrice(
        decimal? price,
        decimal? quantity)
    {
        if (
            !price.HasValue
            ||
            !quantity.HasValue
            ||
            quantity.Value <= 0)
        {
            return null;
        }

        return
            price.Value
            /
            quantity.Value;
    }

    private sealed record HistoryPoint(
        DateTimeOffset RecordedAt,
        decimal Price,
        decimal Quantity,
        decimal UnitPrice);

    private sealed record ResolvedOffer(
        decimal Price,
        decimal Quantity,
        ItemSource? Source);
}

internal sealed class ImportResult
{
    public int Items { get; set; }

    public int Sources { get; set; }

    public int HistoryRows { get; set; }

    public int Runs { get; set; }

    public int ScrapeResults { get; set; }

    public int Subscriptions { get; set; }

    public List<string> Warnings { get; } = [];
}
