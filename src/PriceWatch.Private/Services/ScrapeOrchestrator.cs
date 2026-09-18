using Microsoft.EntityFrameworkCore;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Data.Entities;
using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed class ScrapeOrchestrator
{
    private readonly PriceWatchDbContext _db;
    private readonly PythonScraperClient _python;
    private readonly PriceValidationService _validation;
    private readonly OfferSelectionService _offers;
    private readonly PriceUpdateService _priceUpdate;
    private readonly ILogger<ScrapeOrchestrator> _logger;

    public ScrapeOrchestrator(
        PriceWatchDbContext db,
        PythonScraperClient python,
        PriceValidationService validation,
        OfferSelectionService offers,
        PriceUpdateService priceUpdate,
        ILogger<ScrapeOrchestrator> logger)
    {
        _db = db;
        _python = python;
        _validation = validation;
        _offers = offers;
        _priceUpdate = priceUpdate;
        _logger = logger;
    }

    public async Task<Guid> RunOnceAsync(
        CancellationToken ct = default)
    {
        var startedAt = DateTimeOffset.UtcNow;

        var items = await _db.TrackedItems
            .Include(x => x.Sources)
            .Where(x =>
                x.ArchivedAt == null &&
                x.TrackingEnabled)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var run = new ScrapeRun
        {
            Id = Guid.NewGuid(),
            StartedAt = startedAt,
            Status = ScrapeRunStatus.Running,
            TotalItems = items.Count,
            Successful = 0,
            Failed = 0,
            Suspicious = 0
        };

        _db.ScrapeRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Starting scrape run {RunId} for {ItemCount} active items.",
            run.Id,
            items.Count);

        try
        {
            var jobs = items
                .SelectMany(item => item.Sources
                    .Where(source =>
                        source.ScrapingEnabled &&
                        !string.IsNullOrWhiteSpace(source.Url))
                    .Select(source => new ScrapeJob
                    {
                        ItemId = item.Id,
                        SourceId = source.Id,
                        Name = item.Name,
                        Store = source.Store,
                        Url = source.Url!
                    }))
                .ToList();

            IReadOnlyList<ScrapeWorkerResult> workerResults;

            try
            {
                workerResults = await _python.ScrapeAsync(jobs, ct);
            }
            catch (Exception exception)
            {
                _logger.LogError(
                    exception,
                    "Python batch failed. Every automatic source in this run will be recorded as failed.");

                workerResults = jobs
                    .Select(job => new ScrapeWorkerResult
                    {
                        ItemId = job.ItemId,
                        SourceId = job.SourceId,
                        Ok = false,
                        Error = exception.Message
                    })
                    .ToList();
            }

            var resultMap = workerResults
                .GroupBy(x => (x.ItemId, x.SourceId))
                .ToDictionary(
                    group => group.Key,
                    group => group.Last());

            foreach (var item in items)
            {
                ct.ThrowIfCancellationRequested();

                var itemHadSuccess = false;
                var itemHadSuspicious = false;
                var itemHadFailed = false;
                var automaticSources = item.Sources
                    .Where(x => x.ScrapingEnabled)
                    .ToList();

                item.LastCheckedAt = DateTimeOffset.UtcNow;
                item.UpdatedAt = DateTimeOffset.UtcNow;

                foreach (var source in automaticSources)
                {
                    var createdAt = DateTimeOffset.UtcNow;

                    if (string.IsNullOrWhiteSpace(source.Url))
                    {
                        _db.ScrapeResults.Add(new ScrapeResult
                        {
                            RunId = run.Id,
                            ItemId = item.Id,
                            SourceId = source.Id,
                            ResultStatus = ScrapeResultStatus.Failed,
                            ReviewStatus = ReviewStatus.Pending,
                            Error = "Scraping source URL is missing.",
                            CreatedAt = createdAt
                        });

                        itemHadFailed = true;
                        continue;
                    }

                    resultMap.TryGetValue(
                        (item.Id, source.Id),
                        out var workerResult);

                    if (
                        workerResult is null ||
                        !workerResult.Ok ||
                        !workerResult.Price.HasValue)
                    {
                        _db.ScrapeResults.Add(new ScrapeResult
                        {
                            RunId = run.Id,
                            ItemId = item.Id,
                            SourceId = source.Id,
                            ResultStatus = ScrapeResultStatus.Failed,
                            ReviewStatus = ReviewStatus.Pending,
                            Error = workerResult?.Error ?? "Python scraper returned no result.",
                            CreatedAt = createdAt
                        });

                        itemHadFailed = true;
                        continue;
                    }

                    var quantity = source.DefaultQuantity > 0
                        ? source.DefaultQuantity
                        : 1m;

                    var decision = await _validation.ValidateAsync(
                        item,
                        source,
                        workerResult.Price.Value,
                        quantity,
                        ct);

                    var result = new ScrapeResult
                    {
                        RunId = run.Id,
                        ItemId = item.Id,
                        SourceId = source.Id,
                        ScrapedPrice = workerResult.Price.Value,
                        ScrapedQuantity = quantity,
                        ResultStatus = decision.Status,
                        ReviewStatus = decision.Status == ScrapeResultStatus.Success
                            ? ReviewStatus.NotRequired
                            : ReviewStatus.Pending,
                        SuspiciousReason = decision.SuspiciousReason,
                        Error = decision.Error,
                        CreatedAt = createdAt
                    };

                    _db.ScrapeResults.Add(result);

                    if (decision.Status == ScrapeResultStatus.Success)
                    {
                        itemHadSuccess = true;
                    }
                    else if (decision.Status == ScrapeResultStatus.Suspicious)
                    {
                        itemHadSuspicious = true;
                    }
                    else
                    {
                        itemHadFailed = true;
                    }
                }

                await _db.SaveChangesAsync(ct);

                var best = await _offers.GetBestAcceptedOfferAsync(
                    item.Id,
                    ct);

                if (best is not null)
                {
                    await _priceUpdate.ApplyAcceptedPriceAsync(
                        item.Id,
                        best.Price,
                        best.Quantity,
                        best.Origin,
                        sourceId: best.SourceId,
                        scrapeResultId: best.ScrapeResultId,
                        cancellationToken: ct);

                    await _db.SaveChangesAsync(ct);
                }

                if (automaticSources.Count == 0)
                {
                    if (best is not null)
                    {
                        run.Successful++;
                    }
                    else
                    {
                        run.Failed++;
                    }
                }
                else if (itemHadSuspicious)
                {
                    run.Suspicious++;
                }
                else if (itemHadSuccess && !itemHadFailed)
                {
                    run.Successful++;
                }
                else if (itemHadSuccess)
                {
                    run.Suspicious++;
                }
                else
                {
                    run.Failed++;
                }

                await _db.SaveChangesAsync(ct);
            }

            run.FinishedAt = DateTimeOffset.UtcNow;
            run.Status = DetermineRunStatus(run);

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Finished scrape run {RunId}: {Status}. Success={Success}, Suspicious={Suspicious}, Failed={Failed}.",
                run.Id,
                run.Status,
                run.Successful,
                run.Suspicious,
                run.Failed);

            return run.Id;
        }
        catch
        {
            run.FinishedAt = DateTimeOffset.UtcNow;
            run.Status = ScrapeRunStatus.Failed;
            await _db.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    private static ScrapeRunStatus DetermineRunStatus(
        ScrapeRun run)
    {
        if (run.TotalItems == 0)
        {
            return ScrapeRunStatus.Success;
        }

        if (run.Failed == 0 && run.Suspicious == 0)
        {
            return ScrapeRunStatus.Success;
        }

        if (run.Successful == 0 && run.Suspicious == 0)
        {
            return ScrapeRunStatus.Failed;
        }

        return ScrapeRunStatus.Partial;
    }
}
