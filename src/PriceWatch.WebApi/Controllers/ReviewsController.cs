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


    // ========================================================
    // GET /api/reviews/pending
    // ========================================================

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
            .Where(x =>
                x.ReviewStatus == ReviewStatus.Pending)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,

                x.RunId,

                x.ItemId,

                ItemName =
                    x.Item.Name,

                x.SourceId,

                Store =
                    x.Source != null
                        ? x.Source.Store
                        : null,

                x.ResultStatus,

                x.ReviewStatus,

                x.ScrapedPrice,

                x.ScrapedQuantity,

                x.ScrapedUnitPrice,

                CurrentUnitPrice =
                    x.Item.CurrentUnitPrice,

                TargetUnitPrice =
                    x.Item.TargetUnitPrice,

                x.SuspiciousReason,

                x.Error,

                x.CreatedAt
            })
            .ToListAsync(ct);


        return Ok(results);
    }


    // ========================================================
    // POST /api/reviews/{id}/accept
    //
    // Accept the scraped value into this run's offer set.
    // The current item price is then recalculated from all accepted offers.
    // ========================================================

    [HttpPost("{id:long}/accept")]
    public async Task<IActionResult> Accept(
        long id,
        CancellationToken ct)
    {
        await using var transaction =
            await _db.Database.BeginTransactionAsync(ct);


        var result = await _db.ScrapeResults
            .SingleOrDefaultAsync(
                x => x.Id == id,
                ct);


        if (result is null)
        {
            return NotFound();
        }


        if (result.ReviewStatus != ReviewStatus.Pending)
        {
            return Conflict(new
            {
                error =
                    "This scrape result has already been reviewed."
            });
        }


        if (
            result.ScrapedPrice is null ||
            result.ScrapedQuantity is null)
        {
            return BadRequest(new
            {
                error =
                    "This scrape result does not contain a usable scraped price and quantity."
            });
        }


        if (result.ScrapedQuantity <= 0)
        {
            return BadRequest(new
            {
                error =
                    "Scraped quantity must be greater than zero."
            });
        }


        if (result.ScrapedPrice < 0)
        {
            return BadRequest(new
            {
                error =
                    "Scraped price cannot be negative."
            });
        }


        var now =
            DateTimeOffset.UtcNow;


        result.ReviewStatus =
            ReviewStatus.Accepted;

        result.ReviewedAt =
            now;


        // Persist the review decision first so the shared offer selector
        // sees this result as accepted inside the current transaction.
        await _db.SaveChangesAsync(ct);

        await RefreshProjectedPriceAsync(
            result,
            ct);

        await _db.SaveChangesAsync(ct);

        await transaction.CommitAsync(ct);


        return NoContent();
    }


    // ========================================================
    // POST /api/reviews/{id}/reject
    //
    // Reject does NOT modify CurrentPrice or PriceHistory.
    // ========================================================

    [HttpPost("{id:long}/reject")]
    public async Task<IActionResult> Reject(
        long id,
        [FromBody] RejectReviewRequest? request,
        CancellationToken ct)
    {
        var result = await _db.ScrapeResults
            .SingleOrDefaultAsync(
                x => x.Id == id,
                ct);


        if (result is null)
        {
            return NotFound();
        }


        if (result.ReviewStatus != ReviewStatus.Pending)
        {
            return Conflict(new
            {
                error =
                    "This scrape result has already been reviewed."
            });
        }


        result.ReviewStatus =
            ReviewStatus.Rejected;

        result.ReviewNote =
            Normalize(request?.Note);

        result.ReviewedAt =
            DateTimeOffset.UtcNow;


        await _db.SaveChangesAsync(ct);


        return NoContent();
    }


    // ========================================================
    // POST /api/reviews/{id}/manual
    //
    // Ignore the scraped value and accept a manually
    // corrected package price / quantity for this source.
    // The corrected offer still competes with the other accepted offers.
    // ========================================================

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
                error =
                    "Price cannot be negative."
            });
        }


        if (request.Quantity <= 0)
        {
            return BadRequest(new
            {
                error =
                    "Quantity must be greater than zero."
            });
        }


        await using var transaction =
            await _db.Database.BeginTransactionAsync(ct);


        var result = await _db.ScrapeResults
            .SingleOrDefaultAsync(
                x => x.Id == id,
                ct);


        if (result is null)
        {
            return NotFound();
        }


        if (result.ReviewStatus != ReviewStatus.Pending)
        {
            return Conflict(new
            {
                error =
                    "This scrape result has already been reviewed."
            });
        }


        var now =
            DateTimeOffset.UtcNow;


        result.ManualPrice =
            request.Price;

        result.ManualQuantity =
            request.Quantity;

        result.ReviewNote =
            Normalize(request.Note);

        result.ReviewStatus =
            ReviewStatus.ManualOverride;

        result.ReviewedAt =
            now;


        // ManualOverride corrects this source observation; it does not
        // force that source to become the item's current best offer.
        await _db.SaveChangesAsync(ct);

        await RefreshProjectedPriceAsync(
            result,
            ct);

        await _db.SaveChangesAsync(ct);

        await transaction.CommitAsync(ct);


        return NoContent();
    }


    // ========================================================
    // Helper
    // ========================================================

    private async Task RefreshProjectedPriceAsync(
        ScrapeResult reviewedResult,
        CancellationToken ct)
    {
        // Historical review decisions remain part of the audit trail, but
        // must not roll CurrentPrice back after a newer run has observed the item.
        if (!await _offers.IsLatestRunForItemAsync(
                reviewedResult.ItemId,
                reviewedResult.RunId,
                ct))
        {
            return;
        }

        var best = await _offers.GetBestAcceptedOfferAsync(
            reviewedResult.ItemId,
            reviewedResult.RunId,
            ct);

        if (best is null)
        {
            return;
        }

        await _priceUpdateService.ApplyAcceptedPriceAsync(
            itemId:
                reviewedResult.ItemId,

            price:
                best.Price,

            quantity:
                best.Quantity,

            origin:
                best.Origin,

            sourceId:
                best.SourceId,

            scrapeResultId:
                best.ScrapeResultId,

            observedAt:
                best.ObservedAt,

            cancellationToken:
                ct);
    }

    private static string? Normalize(
        string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}