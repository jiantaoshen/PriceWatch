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
    private readonly PriceUpdateService _priceUpdateService;
    private readonly OfferSelectionService _offers;

    public ReviewsController(
        PriceWatchDbContext db,
        PriceUpdateService priceUpdateService,
        OfferSelectionService offers)
    {
        _db = db;
        _priceUpdateService = priceUpdateService;
        _offers = offers;
    }

    [HttpGet("pending/count")]
    public async Task<IActionResult> GetPendingCount(
        CancellationToken ct)
    {
        var count = await _db.ScrapeResults
            .AsNoTracking()
            .CountAsync(x => x.ReviewStatus == ReviewStatus.Pending, ct);

        return Ok(new { count });
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPending(
        CancellationToken ct)
    {
        var results = await _db.ScrapeResults
            .AsNoTracking()
            .Where(x => x.ReviewStatus == ReviewStatus.Pending)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.RunId,
                x.ItemId,
                ItemName = x.Item.Name,
                x.SourceId,
                Store = x.Source != null ? x.Source.Store : null,
                x.ResultStatus,
                x.ReviewStatus,
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ScrapedUnitPrice,
                CurrentUnitPrice = x.Item.CurrentUnitPrice,
                TargetUnitPrice = x.Item.TargetUnitPrice,
                x.SuspiciousReason,
                x.Error,
                x.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(results);
    }

    [HttpPost("{id:long}/accept")]
    public async Task<IActionResult> Accept(
        long id,
        CancellationToken ct)
    {
        var target = await GetReviewTargetAsync(id, ct);
        if (target is null)
        {
            return NotFound();
        }

        if (target.ReviewStatus != ReviewStatus.Pending)
        {
            return AlreadyReviewed();
        }

        if (
            target.ScrapedPrice is null ||
            target.ScrapedQuantity is null)
        {
            return BadRequest(new
            {
                error =
                    "This scrape result does not contain a usable scraped price and quantity."
            });
        }

        if (target.ScrapedQuantity <= 0)
        {
            return BadRequest(new
            {
                error = "Scraped quantity must be greater than zero."
            });
        }

        if (target.ScrapedPrice < 0)
        {
            return BadRequest(new
            {
                error = "Scraped price cannot be negative."
            });
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var updated = await _db.ScrapeResults
            .Where(x =>
                x.Id == id &&
                x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.ReviewStatus,
                        ReviewStatus.Accepted)
                    .SetProperty(
                        x => x.ReviewedAt,
                        now),
                ct);

        if (updated != 1)
        {
            return AlreadyReviewed();
        }

        await RefreshProjectedPriceAsync(
            target.ItemId,
            target.RunId,
            ct);

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:long}/reject")]
    public async Task<IActionResult> Reject(
        long id,
        [FromBody] RejectReviewRequest? request,
        CancellationToken ct)
    {
        if (!await _db.ScrapeResults
                .AsNoTracking()
                .AnyAsync(x => x.Id == id, ct))
        {
            return NotFound();
        }

        var now = DateTimeOffset.UtcNow;
        var note = Normalize(request?.Note);

        var updated = await _db.ScrapeResults
            .Where(x =>
                x.Id == id &&
                x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(
                        x => x.ReviewStatus,
                        ReviewStatus.Rejected)
                    .SetProperty(
                        x => x.ReviewNote,
                        note)
                    .SetProperty(
                        x => x.ReviewedAt,
                        now),
                ct);

        if (updated != 1)
        {
            return AlreadyReviewed();
        }

        return NoContent();
    }

    [HttpPost("{id:long}/manual")]
    public async Task<IActionResult> ManualOverride(
        long id,
        [FromBody] ManualReviewRequest request,
        CancellationToken ct)
    {
        if (request.Price < 0)
        {
            return BadRequest(new
            {
                error = "Price cannot be negative."
            });
        }

        if (request.Quantity <= 0)
        {
            return BadRequest(new
            {
                error = "Quantity must be greater than zero."
            });
        }

        var target = await GetReviewTargetAsync(id, ct);
        if (target is null)
        {
            return NotFound();
        }

        if (target.ReviewStatus != ReviewStatus.Pending)
        {
            return AlreadyReviewed();
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var note = Normalize(request.Note);

        var updated = await _db.ScrapeResults
            .Where(x =>
                x.Id == id &&
                x.ReviewStatus == ReviewStatus.Pending)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(x => x.ManualPrice, request.Price)
                    .SetProperty(x => x.ManualQuantity, request.Quantity)
                    .SetProperty(x => x.ReviewNote, note)
                    .SetProperty(
                        x => x.ReviewStatus,
                        ReviewStatus.ManualOverride)
                    .SetProperty(
                        x => x.ReviewedAt,
                        now),
                ct);

        if (updated != 1)
        {
            return AlreadyReviewed();
        }

        await RefreshProjectedPriceAsync(
            target.ItemId,
            target.RunId,
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
                x.RunId,
                x.ReviewStatus,
                x.ScrapedPrice,
                x.ScrapedQuantity))
            .SingleOrDefaultAsync(ct);
    }

    private async Task RefreshProjectedPriceAsync(
        Guid itemId,
        Guid runId,
        CancellationToken ct)
    {
        if (!await _offers.IsLatestRunForItemAsync(
                itemId,
                runId,
                ct))
        {
            return;
        }

        var best = await _offers.GetBestAcceptedOfferAsync(
            itemId,
            runId,
            ct);

        if (best is null)
        {
            return;
        }

        await _priceUpdateService.ApplyAcceptedPriceAsync(
            itemId: itemId,
            price: best.Price,
            quantity: best.Quantity,
            origin: best.Origin,
            sourceId: best.SourceId,
            scrapeResultId: best.ScrapeResultId,
            observedAt: best.ObservedAt,
            cancellationToken: ct);
    }

    private ConflictObjectResult AlreadyReviewed()
    {
        return Conflict(new
        {
            error = "This scrape result has already been reviewed."
        });
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private sealed record ReviewTarget(
        Guid ItemId,
        Guid RunId,
        ReviewStatus ReviewStatus,
        decimal? ScrapedPrice,
        decimal? ScrapedQuantity);
}
