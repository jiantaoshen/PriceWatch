using Microsoft.EntityFrameworkCore;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Data.Entities;
using PriceWatch.Private.Infrastructure;
using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed class ScrapeOrchestrator
{
    private readonly PriceWatchDbContext _db;
    private readonly PythonScraperClient _python;
    private readonly PriceValidationService _validation;
    private readonly PriceTrackingService _prices;
    private readonly ILogger<ScrapeOrchestrator> _logger;

    public ScrapeOrchestrator(
        PriceWatchDbContext db,
        PythonScraperClient python,
        PriceValidationService validation,
        PriceTrackingService prices,
        ILogger<ScrapeOrchestrator> logger)
    {
        _db = db;
        _python = python;
        _validation = validation;
        _prices = prices;
        _logger = logger;
    }

    public async Task<Guid?> RunOnceAsync(
        ScrapeTrigger trigger,
        CancellationToken ct = default)
    {
        var startedAt = DateTimeOffset.UtcNow;

        var items = await _db.TrackedItems
            .Include(x => x.Sources)
            .Where(x =>
                x.ArchivedAt == null &&
                x.TrackingEnabled &&
                x.Sources.Any(source =>
                    source.ArchivedAt == null &&
                    source.ScrapingEnabled))
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        if (trigger == ScrapeTrigger.Scheduled)
        {
            items = items
                .Where(item => IsDueForScheduledRun(item, startedAt))
                .ToList();

            if (items.Count == 0)
            {
                _logger.LogInformation(
                    "Scheduled scrape skipped because no scraping-enabled items are due.");
                return null;
            }
        }
        else if (items.Count == 0)
        {
            _logger.LogInformation(
                "On-demand scrape skipped because no tracked items have active scraping-enabled sources.");
            return null;
        }

        var run = new ScrapeRun
        {
            Id = Guid.NewGuid(),
            StartedAt = startedAt,
            Status = ScrapeRunStatus.Running,
            TotalItems = items.Count
        };

        _db.ScrapeRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        try
        {
            var runHadAcceptedResult = false;
            var jobs = items
                .SelectMany(item => item.Sources
                    .Where(source =>
                        source.ArchivedAt == null &&
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
                var errorId = Guid.NewGuid();

                _logger.LogError(
                    "Python batch failed. ErrorId={ErrorId}, Type={ExceptionType}, StackTrace={StackTrace}",
                    errorId,
                    exception.GetType().FullName,
                    exception.StackTrace);

                workerResults = jobs
                    .Select(job => new ScrapeWorkerResult
                    {
                        ItemId = job.ItemId,
                        SourceId = job.SourceId,
                        Ok = false,
                        Error = $"Scraper worker failed. Error ID: {errorId}",
                        ObservedAt = DateTimeOffset.UtcNow
                    })
                    .ToList();
            }

            var resultMap = workerResults
                .GroupBy(x => (x.ItemId, x.SourceId))
                .ToDictionary(group => group.Key, group => group.Last());

            foreach (var item in items)
            {
                ct.ThrowIfCancellationRequested();

                var itemHadSuccess = false;
                var itemHadSuspicious = false;
                var itemHadFailed = false;
                var accepted = new List<(ScrapeResult Result, decimal Price, decimal Quantity)>();

                var scrapingSources = item.Sources
                    .Where(x => x.ArchivedAt == null && x.ScrapingEnabled)
                    .ToList();

                item.LastCheckedAt = DateTimeOffset.UtcNow;
                item.UpdatedAt = DateTimeOffset.UtcNow;

                foreach (var source in scrapingSources)
                {
                    var createdAt = DateTimeOffset.UtcNow;

                    resultMap.TryGetValue((item.Id, source.Id), out var workerResult);
                    var observedAt = workerResult?.ObservedAt ?? createdAt;

                    if (string.IsNullOrWhiteSpace(source.Url))
                    {
                        _db.ScrapeResults.Add(FailedResult(
                            run.Id,
                            item.Id,
                            source.Id,
                            "Scraping source URL is missing.",
                            observedAt,
                            createdAt));
                        itemHadFailed = true;
                        continue;
                    }

                    if (workerResult is null || !workerResult.Ok || !workerResult.Price.HasValue)
                    {
                        _db.ScrapeResults.Add(FailedResult(
                            run.Id,
                            item.Id,
                            source.Id,
                            workerResult?.Error is { } workerError
                                ? SensitiveDataRedactor.Redact(workerError)
                                : "Python scraper returned no result.",
                            observedAt,
                            createdAt));
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
                        ObservedAt = observedAt,
                        CreatedAt = createdAt
                    };

                    _db.ScrapeResults.Add(result);

                    if (decision.Status == ScrapeResultStatus.Success)
                    {
                        itemHadSuccess = true;
                        runHadAcceptedResult = true;
                        accepted.Add((result, workerResult.Price.Value, quantity));
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

                // Save scrape results first so accepted observations can reference them.
                await _db.SaveChangesAsync(ct);

                foreach (var observation in accepted)
                {
                    _prices.AddObservation(
                        item.Id,
                        observation.Result.SourceId,
                        observation.Price,
                        observation.Quantity,
                        PriceOrigin.Scrape,
                        observation.Result.ObservedAt,
                        observation.Result.Id);
                }

                if (accepted.Count > 0)
                {
                    await _db.SaveChangesAsync(ct);

                    await _prices.RecalculateBestPriceAsync(
                        item.Id,
                        BestPriceChangeCause.Automatic,
                        accepted.Max(x => x.Result.ObservedAt),
                        ct);

                    await _db.SaveChangesAsync(ct);
                }

                if (itemHadSuspicious)
                    run.Suspicious++;
                else if (itemHadFailed)
                    run.Failed++;
                else if (itemHadSuccess)
                    run.Successful++;

                await _db.SaveChangesAsync(ct);
            }

            run.FinishedAt = DateTimeOffset.UtcNow;
            run.Status = DetermineRunStatus(run, runHadAcceptedResult);
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

    private static ScrapeResult FailedResult(
        Guid runId,
        Guid itemId,
        long sourceId,
        string error,
        DateTimeOffset observedAt,
        DateTimeOffset createdAt) => new()
        {
            RunId = runId,
            ItemId = itemId,
            SourceId = sourceId,
            ResultStatus = ScrapeResultStatus.Failed,
            ReviewStatus = ReviewStatus.Pending,
            Error = error,
            ObservedAt = observedAt,
            CreatedAt = createdAt
        };

    private static bool IsDueForScheduledRun(
        TrackedItem item,
        DateTimeOffset now)
    {
        if (!item.Sources.Any(source =>
                source.ArchivedAt == null &&
                source.ScrapingEnabled))
        {
            return false;
        }

        if (!item.CheckIntervalMinutes.HasValue || !item.LastCheckedAt.HasValue)
            return true;

        if (item.CheckIntervalMinutes.Value <= 0)
            return true;

        return now - item.LastCheckedAt.Value >=
            TimeSpan.FromMinutes(item.CheckIntervalMinutes.Value);
    }

    private static ScrapeRunStatus DetermineRunStatus(
        ScrapeRun run,
        bool hadAcceptedResult)
    {
        if (run.TotalItems == 0 || (run.Failed == 0 && run.Suspicious == 0))
            return ScrapeRunStatus.Success;

        if (hadAcceptedResult || run.Suspicious > 0)
            return ScrapeRunStatus.Partial;

        return ScrapeRunStatus.Failed;
    }
}
