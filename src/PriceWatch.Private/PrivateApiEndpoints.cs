using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;
using PriceWatch.Private.Models;
using PriceWatch.Private.Services;

namespace PriceWatch.Private;

public static class PrivateApiEndpoints
{
    public static IEndpointRouteBuilder MapPrivateApi(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/private");

        group.MapGet("/health", () => Results.Ok(new
        {
            status = "ok",
            service = "PriceWatch.Private",
            timestamp = DateTimeOffset.UtcNow
        }));

        group.MapGet("/dashboard", DashboardAsync);
        group.MapGet("/items", ItemsAsync);
        group.MapGet("/runs", RunsAsync);
        group.MapGet("/runs/{id:guid}/results", RunResultsAsync);
        group.MapGet("/status", StatusAsync);

        group.MapPost("/run", StartRunAsync);

        group.MapGet("/schedule", async (
            WindowsScheduleService schedule) =>
            Results.Ok(await schedule.GetAsync()));

        group.MapPut("/schedule", async (
            ScheduleRequest request,
            WindowsScheduleService schedule) =>
        {
            try
            {
                return Results.Ok(
                    await schedule.ApplyAsync(request));
            }
            catch (ArgumentException)
            {
                return Results.BadRequest(new
                {
                    error = "Invalid schedule configuration."
                });
            }
            catch (PlatformNotSupportedException)
            {
                return Results.Problem(
                    detail: "Windows Task Scheduler is only supported on Windows.",
                    statusCode: StatusCodes.Status501NotImplemented);
            }
        });

        group.MapDelete("/schedule", async (
            WindowsScheduleService schedule) =>
        {
            await schedule.DeleteAsync();
            return Results.NoContent();
        });

        group.MapGet("/email-settings", async (
            EmailAlertSettingsStore store,
            CancellationToken ct) =>
            Results.Ok(await store.GetResponseAsync(ct)));

        group.MapPut("/email-settings", SaveEmailSettingsAsync);
        group.MapPost("/email-settings/test", SendTestEmailAsync);

        return endpoints;
    }

    private static async Task<IResult> SaveEmailSettingsAsync(
        UpdateEmailSettingsRequest request,
        EmailAlertSettingsStore store,
        CancellationToken ct)
    {
        try
        {
            return Results.Ok(await store.SaveAsync(request, ct));
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                error = exception.Message
            });
        }
    }

    private static async Task<IResult> SendTestEmailAsync(
        PriceAlertEmailSender sender,
        ILoggerFactory loggerFactory,
        CancellationToken ct)
    {
        try
        {
            await sender.SendTestAsync(ct);
            return Results.Ok(new
            {
                status = "sent"
            });
        }
        catch (InvalidOperationException exception)
        {
            return Results.BadRequest(new
            {
                error = exception.Message
            });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            var errorId = Guid.NewGuid();
            var logger = loggerFactory.CreateLogger("PriceWatch.Private.EmailTest");

            logger.LogError(
                "Test email delivery failed. ErrorId={ErrorId}, Type={ExceptionType}, StackTrace={StackTrace}",
                errorId,
                exception.GetType().FullName,
                exception.StackTrace);

            return Results.Problem(
                detail: $"Test email could not be sent. Error ID: {errorId}",
                statusCode: StatusCodes.Status502BadGateway);
        }
    }

    private static async Task<IResult> StartRunAsync(
        ScrapeRunCoordinator coordinator,
        CancellationToken ct)
    {
        var result = await coordinator.TryStartAsync(ct);

        if (result == ScrapeStartResult.AlreadyRunning)
        {
            return Results.Conflict(new
            {
                error = "A PriceWatch run is already in progress.",
                reason = "already_running"
            });
        }

        return Results.Accepted(
            "/api/private/status",
            new
            {
                status = "started"
            });
    }

    private static async Task<IResult> DashboardAsync(
        PriceWatchDbContext db,
        ScrapeRunCoordinator coordinator,
        CancellationToken ct)
    {
        var activeItems = await db.TrackedItems
            .AsNoTracking()
            .CountAsync(x =>
                x.ArchivedAt == null &&
                x.TrackingEnabled,
                ct);

        var scrapingSources = await db.ItemSources
            .AsNoTracking()
            .CountAsync(x =>
                x.Item.ArchivedAt == null &&
                x.Item.TrackingEnabled &&
                x.ArchivedAt == null &&
                x.ScrapingEnabled,
                ct);

        var pendingReviews = await db.ScrapeResults
            .AsNoTracking()
            .CountAsync(x =>
                x.ReviewStatus == ReviewStatus.Pending,
                ct);

        var lastRun = await db.ScrapeRuns
            .AsNoTracking()
            .OrderByDescending(x => x.StartedAt)
            .Select(x => new
            {
                x.Id,
                x.Status,
                x.StartedAt,
                x.FinishedAt,
                x.TotalItems,
                x.Successful,
                x.Suspicious,
                x.Failed
            })
            .FirstOrDefaultAsync(ct);

        return Results.Ok(new
        {
            coordinator = coordinator.GetStatus(),
            activeItems,
            scrapingSources,
            pendingReviews,
            lastRun
        });
    }

    private static async Task<IResult> ItemsAsync(
        PriceWatchDbContext db,
        bool includeArchived = false,
        CancellationToken ct = default)
    {
        var query = db.TrackedItems
            .AsNoTracking()
            .Include(x => x.Sources)
            .AsQueryable();

        if (!includeArchived)
            query = query.Where(x => x.ArchivedAt == null);

        var items = await query
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var itemIds = items.Select(x => x.Id).ToArray();
        var states = await db.BestPriceStates
            .AsNoTracking()
            .Include(x => x.Sources)
                .ThenInclude(x => x.Source)
            .Where(x => itemIds.Contains(x.ItemId))
            .OrderByDescending(x => x.RecordedAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        var latestStateByItem = states
            .GroupBy(x => x.ItemId)
            .ToDictionary(group => group.Key, group => group.First());

        return Results.Ok(items.Select(item =>
        {
            latestStateByItem.TryGetValue(item.Id, out var state);
            var activeSources = item.Sources.Where(x => x.ArchivedAt == null).ToList();

            return new
            {
                item.Id,
                item.ItemType,
                item.Name,
                item.Currency,
                item.Unit,
                item.TargetUnitPrice,
                item.CurrentUnitPrice,
                item.PreviousUnitPrice,
                CurrentStores = item.CurrentUnitPrice.HasValue
                    ? state?.Sources
                        .Where(x => x.Source.ArchivedAt == null)
                        .Select(x => x.Source.Store)
                        .OrderBy(x => x)
                        .ToArray() ?? []
                    : [],
                SourceCount = activeSources.Count,
                HasScrapingSources = activeSources.Any(x => x.ScrapingEnabled),
                item.CheckIntervalMinutes,
                item.TrackingEnabled,
                item.LastCheckedAt,
                item.LastPriceChangedAt,
                item.ArchivedAt
            };
        }));
    }

    private static async Task<IResult> RunsAsync(
        PriceWatchDbContext db,
        int limit = 25,
        CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);

        var runs = await db.ScrapeRuns
            .AsNoTracking()
            .OrderByDescending(x => x.StartedAt)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.Status,
                x.StartedAt,
                x.FinishedAt,
                x.TotalItems,
                x.Successful,
                x.Suspicious,
                x.Failed
            })
            .ToListAsync(ct);

        return Results.Ok(runs);
    }

    private static async Task<IResult> RunResultsAsync(
        Guid id,
        PriceWatchDbContext db,
        CancellationToken ct = default)
    {
        var exists = await db.ScrapeRuns
            .AsNoTracking()
            .AnyAsync(x => x.Id == id, ct);

        if (!exists)
        {
            return Results.NotFound();
        }

        var results = await db.ScrapeResults
            .AsNoTracking()
            .Where(x => x.RunId == id)
            .OrderBy(x => x.Item.Name)
            .ThenBy(x => x.Source != null ? x.Source.Store : "")
            .Select(x => new
            {
                x.Id,
                x.ItemId,
                ItemName = x.Item.Name,
                x.SourceId,
                Store = x.Source.Store,
                x.ResultStatus,
                x.ReviewStatus,
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ScrapedUnitPrice,
                x.SuspiciousReason,
                x.Error,
                x.ObservedAt,
                x.CreatedAt,
                x.ReviewedAt
            })
            .ToListAsync(ct);

        return Results.Ok(results);
    }

    private static async Task<IResult> StatusAsync(
        PriceWatchDbContext db,
        ScrapeRunCoordinator coordinator,
        CancellationToken ct = default)
    {
        var lastRun = await db.ScrapeRuns
            .AsNoTracking()
            .OrderByDescending(x => x.StartedAt)
            .Select(x => new
            {
                x.Id,
                x.Status,
                x.StartedAt,
                x.FinishedAt,
                x.TotalItems,
                x.Successful,
                x.Suspicious,
                x.Failed
            })
            .FirstOrDefaultAsync(ct);

        return Results.Ok(new
        {
            coordinator = coordinator.GetStatus(),
            lastRun
        });
    }
}
