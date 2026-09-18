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

        group.MapPost("/run", (
            ScrapeRunCoordinator coordinator) =>
        {
            if (!coordinator.TryStart())
            {
                return Results.Conflict(new
                {
                    error = "A PriceWatch run is already in progress."
                });
            }

            return Results.Accepted(
                "/api/private/status",
                new
                {
                    status = "started"
                });
        });

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
            catch (ArgumentException exception)
            {
                return Results.BadRequest(new
                {
                    error = exception.Message
                });
            }
            catch (PlatformNotSupportedException exception)
            {
                return Results.Problem(
                    detail: exception.Message,
                    statusCode: StatusCodes.Status501NotImplemented);
            }
        });

        group.MapDelete("/schedule", async (
            WindowsScheduleService schedule) =>
        {
            await schedule.DeleteAsync();
            return Results.NoContent();
        });

        return endpoints;
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

        var automaticSources = await db.ItemSources
            .AsNoTracking()
            .CountAsync(x =>
                x.Item.ArchivedAt == null &&
                x.Item.TrackingEnabled &&
                x.ScrapingEnabled,
                ct);

        var manualSources = await db.ItemSources
            .AsNoTracking()
            .CountAsync(x =>
                x.Item.ArchivedAt == null &&
                x.Item.TrackingEnabled &&
                !x.ScrapingEnabled &&
                x.ManualPrice != null,
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
            automaticSources,
            manualSources,
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
            .AsQueryable();

        if (!includeArchived)
        {
            query = query.Where(x => x.ArchivedAt == null);
        }

        var items = await query
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.ItemType,
                x.Name,
                x.Currency,
                x.Unit,
                x.TargetUnitPrice,
                x.CurrentUnitPrice,
                x.PreviousUnitPrice,
                CurrentStore = x.CurrentSource != null
                    ? x.CurrentSource.Store
                    : null,
                SourceCount = x.Sources.Count,
                AutomaticSourceCount = x.Sources.Count(s => s.ScrapingEnabled),
                ManualSourceCount = x.Sources.Count(s =>
                    !s.ScrapingEnabled &&
                    s.ManualPrice != null),
                x.UpdateMode,
                x.TrackingEnabled,
                x.LastCheckedAt,
                x.LastPriceChangedAt,
                x.ArchivedAt,
                BelowTarget =
                    x.TargetUnitPrice != null &&
                    x.CurrentUnitPrice != null &&
                    x.CurrentUnitPrice <= x.TargetUnitPrice
            })
            .ToListAsync(ct);

        return Results.Ok(items);
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
                Store = x.Source != null ? x.Source.Store : null,
                x.ResultStatus,
                x.ReviewStatus,
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ScrapedUnitPrice,
                x.SuspiciousReason,
                x.Error,
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
