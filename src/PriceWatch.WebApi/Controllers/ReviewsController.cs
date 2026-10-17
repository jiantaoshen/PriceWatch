using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Data.Entities;
using PriceWatch.WebApi.DTOs;

namespace PriceWatch.WebApi.Controllers;

[Authorize(Policy = "OwnerOnly")]
[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly PriceWatchDbContext _db;
    private readonly PriceTrackingService _prices;

    public ReviewsController(
        PriceWatchDbContext db,
        PriceTrackingService prices)
    {
        _db = db;
        _prices = prices;
    }

    [HttpGet("pending/count")]
    public async Task<IActionResult> GetPendingCount(CancellationToken ct)
    {
        var count = await _db.ScrapeResults
            .AsNoTracking()
            .CountAsync(x => x.ReviewStatus == ReviewStatus.Pending, ct);

        return Ok(new { count });
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(CancellationToken ct)
    {
        var results = await _db.ScrapeResults
            .AsNoTracking()
            .Include(x => x.Item)
            .Include(x => x.Source)
            .Where(x => x.ReviewStatus == ReviewStatus.Pending)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        var sourceIds = results.Select(x => x.SourceId).Distinct().ToArray();
        var observations = await _db.PriceObservations
            .AsNoTracking()
            .Where(x => sourceIds.Contains(x.SourceId))
            .OrderByDescending(x => x.ObservedAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        var lastBySource = observations
            .GroupBy(x => x.SourceId)
            .ToDictionary(group => group.Key, group => group.First());

        return Ok(results.Select(result =>
        {
            lastBySource.TryGetValue(result.SourceId, out var last);
            var lastKnownUnitPrice = last is not null && last.Quantity > 0
                ? last.Price / last.Quantity
                : (decimal?)null;

            return new
            {
                result.Id,
                result.RunId,
                result.ItemId,
                ItemName = result.Item.Name,
                result.SourceId,
                result.Source.Store,
                result.Source.DefaultQuantity,
                result.ResultStatus,
                result.ReviewStatus,
                result.ScrapedPrice,
                result.ScrapedQuantity,
                result.ScrapedUnitPrice,
                CurrentUnitPrice = result.Item.CurrentUnitPrice,
                TargetUnitPrice = result.Item.TargetUnitPrice,
                LastKnownUnitPrice = lastKnownUnitPrice,
                HasLastKnownPrice = last is not null,
                result.SuspiciousReason,
                result.Error,
                result.ObservedAt,
                result.CreatedAt,
                result.Item.Currency,
                result.Item.Unit
            };
        }));
    }

    [HttpPost("{id:long}/confirm")]
    public async Task<IActionResult> Confirm(
        long id,
        CancellationToken ct)
    {
        var target = await GetReviewTargetAsync(id, ct);
        if (target is null)
            return NotFound();
        if (target.ReviewStatus != ReviewStatus.Pending)
            return AlreadyReviewed();
        if (target.ResultStatus != ScrapeResultStatus.Suspicious ||
            !target.ScrapedPrice.HasValue ||
            !target.ScrapedQuantity.HasValue ||
            target.ScrapedPrice.Value < 0 ||
            target.ScrapedQuantity.Value <= 0)
        {
            return BadRequest(new
            {
                error = "Only a suspicious result with a usable scraped price can be confirmed."
            });
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        var now = DateTimeOffset.UtcNow;

        var updated = await _db.ScrapeResults
            .Where(x => x.Id == id && x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.ReviewStatus, ReviewStatus.Accepted)
                    .SetProperty(x => x.ReviewedAt, now),
                ct);

        if (updated != 1)
            return AlreadyReviewed();

        _prices.AddObservation(
            target.ItemId,
            target.SourceId,
            target.ScrapedPrice.Value,
            target.ScrapedQuantity.Value,
            PriceOrigin.Scrape,
            target.ObservedAt,
            id);

        await _db.SaveChangesAsync(ct);
        await _prices.RecalculateBestPriceAsync(
            target.ItemId,
            BestPriceChangeCause.Review,
            now,
            ct);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:long}/use-last")]
    public async Task<IActionResult> UseLastKnownPrice(
        long id,
        [FromBody] UseLastReviewRequest? request,
        CancellationToken ct)
    {
        var target = await GetReviewTargetAsync(id, ct);
        if (target is null)
            return NotFound();
        if (target.ReviewStatus != ReviewStatus.Pending)
            return AlreadyReviewed();

        var hasLastKnown = await _db.PriceObservations
            .AsNoTracking()
            .AnyAsync(x => x.SourceId == target.SourceId, ct);

        if (!hasLastKnown)
        {
            return BadRequest(new
            {
                error = "This source has no last known price. Enter a manual price instead."
            });
        }

        var updated = await _db.ScrapeResults
            .Where(x => x.Id == id && x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.ReviewStatus, ReviewStatus.Rejected)
                    .SetProperty(x => x.ReviewNote, Normalize(request?.Note))
                    .SetProperty(x => x.ReviewedAt, DateTimeOffset.UtcNow),
                ct);

        return updated == 1 ? NoContent() : AlreadyReviewed();
    }

    [HttpPost("{id:long}/manual")]
    public async Task<IActionResult> Manual(
        long id,
        [FromBody] ManualReviewRequest request,
        CancellationToken ct)
    {
        if (request.Price < 0)
            return BadRequest(new { error = "Price cannot be negative." });
        if (request.Quantity <= 0)
            return BadRequest(new { error = "Quantity must be greater than zero." });

        var target = await GetReviewTargetAsync(id, ct);
        if (target is null)
            return NotFound();
        if (target.ReviewStatus != ReviewStatus.Pending)
            return AlreadyReviewed();

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);
        var now = DateTimeOffset.UtcNow;

        var updated = await _db.ScrapeResults
            .Where(x => x.Id == id && x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.ReviewNote, Normalize(request.Note))
                    .SetProperty(x => x.ReviewStatus, ReviewStatus.ManualOverride)
                    .SetProperty(x => x.ReviewedAt, now),
                ct);

        if (updated != 1)
            return AlreadyReviewed();

        _prices.AddObservation(
            target.ItemId,
            target.SourceId,
            request.Price,
            request.Quantity,
            PriceOrigin.Manual,
            now);

        await _db.SaveChangesAsync(ct);
        await _prices.RecalculateBestPriceAsync(
            target.ItemId,
            BestPriceChangeCause.Review,
            now,
            ct);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return NoContent();
    }

    private async Task<ReviewTarget?> GetReviewTargetAsync(
        long id,
        CancellationToken ct)
    {
        return await _db.ScrapeResults
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new ReviewTarget(
                x.ItemId,
                x.SourceId,
                x.ResultStatus,
                x.ReviewStatus,
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ObservedAt))
            .SingleOrDefaultAsync(ct);
    }

    private IActionResult AlreadyReviewed() => Conflict(new
    {
        error = "This review was already resolved.",
        reason = "already_reviewed"
    });

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed record ReviewTarget(
        Guid ItemId,
        long SourceId,
        ScrapeResultStatus ResultStatus,
        ReviewStatus ReviewStatus,
        decimal? ScrapedPrice,
        decimal? ScrapedQuantity,
        DateTimeOffset ObservedAt);
}
