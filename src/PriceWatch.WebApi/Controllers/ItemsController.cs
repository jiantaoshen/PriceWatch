using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;
using PriceWatch.WebApi.DTOs;

namespace PriceWatch.WebApi.Controllers;

[Authorize(Policy = "OwnerOnly")]
[ApiController]
[Route("api/items")]
public class ItemsController : ControllerBase
{
    private readonly PriceWatchDbContext _db;

    public ItemsController(PriceWatchDbContext db)
    {
        _db = db;
    }

    // GET /api/items
    // Archived items are hidden unless includeArchived=true.
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var query = _db.TrackedItems
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

                x.UpdateMode,
                x.CheckIntervalMinutes,
                x.TrackingEnabled,

                x.LastCheckedAt,
                x.LastSuccessfulPriceAt,
                x.LastPriceChangedAt,

                x.ArchivedAt,

                BelowTarget =
                    x.TargetUnitPrice != null &&
                    x.CurrentUnitPrice != null &&
                    x.CurrentUnitPrice <= x.TargetUnitPrice,

                MonthlyPrice = x.ItemType == ItemType.Subscription
                ? x.Sources
                    .Where(s =>
                        !s.ScrapingEnabled &&
                        s.ManualPrice != null)
                    .Select(s => s.ManualPrice)
                    .FirstOrDefault()
                : null,
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    // GET /api/items/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(
        Guid id,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.ItemType,
                x.Name,
                x.Currency,
                x.Unit,

                x.TargetPrice,
                x.ComparisonQuantity,
                x.TargetUnitPrice,

                x.CurrentPrice,
                x.CurrentQuantity,
                x.CurrentUnitPrice,
                x.CurrentSourceId,

                CurrentStore = x.CurrentSource != null
                    ? x.CurrentSource.Store
                    : null,

                x.PreviousPrice,
                x.PreviousQuantity,
                x.PreviousUnitPrice,
                x.PreviousSourceId,

                PreviousStore = x.PreviousSource != null
                    ? x.PreviousSource.Store
                    : null,

                x.UpdateMode,
                x.CheckIntervalMinutes,
                x.TrackingEnabled,

                x.LastCheckedAt,
                x.LastSuccessfulPriceAt,
                x.LastPriceChangedAt,

                x.ArchivedAt,
                x.CreatedAt,
                x.UpdatedAt,

                Sources = x.Sources
                    .OrderBy(s => s.Store)
                    .Select(s => new
                    {
                        s.Id,
                        s.Store,
                        s.Url,
                        s.ScrapingEnabled,
                        s.DefaultQuantity,
                        s.ManualPrice,
                        s.Note,
                        s.CreatedAt,
                        s.UpdatedAt
                    })
                    .ToList()
            })
            .SingleOrDefaultAsync(ct);

        return item is null
            ? NotFound()
            : Ok(item);
    }

    // GET /api/items/{id}/history
    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(
        Guid id,
        [FromQuery] DateTimeOffset? from,
        CancellationToken ct = default)
    {
        var itemExists = await _db.TrackedItems
            .AsNoTracking()
            .AnyAsync(x => x.Id == id, ct);

        if (!itemExists)
        {
            return NotFound();
        }

        var query = _db.PriceHistory
            .AsNoTracking()
            .Where(x => x.ItemId == id);

        if (from.HasValue)
        {
            query = query.Where(x => x.RecordedAt >= from.Value);
        }

        var history = await query
            .OrderBy(x => x.RecordedAt)
            .Select(x => new
            {
                x.RecordedAt,
                x.UnitPrice
            })
            .ToListAsync(ct);

        return Ok(history);
    }

    // POST /api/items
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateItemRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateItem(
            request.Name,
            request.Currency,
            request.TargetPrice,
            request.ComparisonQuantity,
            request.CheckIntervalMinutes);

        if (validationError is not null)
        {
            return BadRequest(new { error = validationError });
        }

        var now = DateTimeOffset.UtcNow;

        var item = new TrackedItem
        {
            ItemType = request.ItemType,
            Name = request.Name.Trim(),
            Currency = request.Currency.Trim().ToUpperInvariant(),
            Unit = NormalizeOptional(request.Unit),

            TargetPrice = request.TargetPrice,
            ComparisonQuantity = request.ComparisonQuantity,

            UpdateMode = request.UpdateMode,
            CheckIntervalMinutes = request.CheckIntervalMinutes,
            TrackingEnabled = request.TrackingEnabled,

            CreatedAt = now,
            UpdatedAt = now
        };

        _db.TrackedItems.Add(item);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(GetById),
            new { id = item.Id },
            new { item.Id });
    }

    // PUT /api/items/{id}
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateItemRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateItem(
            request.Name,
            request.Currency,
            request.TargetPrice,
            request.ComparisonQuantity,
            request.CheckIntervalMinutes);

        if (validationError is not null)
        {
            return BadRequest(new { error = validationError });
        }

        var item = await _db.TrackedItems
            .SingleOrDefaultAsync(x => x.Id == id, ct);

        if (item is null)
        {
            return NotFound();
        }

        item.ItemType = request.ItemType;
        item.Name = request.Name.Trim();
        item.Currency = request.Currency.Trim().ToUpperInvariant();
        item.Unit = NormalizeOptional(request.Unit);

        item.TargetPrice = request.TargetPrice;
        item.ComparisonQuantity = request.ComparisonQuantity;

        item.UpdateMode = request.UpdateMode;
        item.CheckIntervalMinutes = request.CheckIntervalMinutes;
        item.TrackingEnabled = request.TrackingEnabled;

        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // POST /api/items/{id}/archive
    //
    // Archive is NOT delete.
    // It means "keep this item and its history, but stop following it for now".
    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(
        Guid id,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .SingleOrDefaultAsync(x => x.Id == id, ct);

        if (item is null)
        {
            return NotFound();
        }

        if (item.ArchivedAt is null)
        {
            var now = DateTimeOffset.UtcNow;

            item.ArchivedAt = now;
            item.TrackingEnabled = false;
            item.UpdatedAt = now;

            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    // POST /api/items/{id}/restore
    //
    // Restoring does not automatically enable tracking.
    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(
        Guid id,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .SingleOrDefaultAsync(x => x.Id == id, ct);

        if (item is null)
        {
            return NotFound();
        }

        item.ArchivedAt = null;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // DELETE /api/items/{id}
    //
    // Permanent deletion.
    //
    // Deletes:
    // - PriceAlertEvents for the item
    // - PriceHistory for the item
    // - ScrapeResults for the item
    // - ItemSources for the item
    // - TrackedItem itself
    //
    // ScrapeRun is deliberately kept because one run may contain
    // results from many different items.
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken ct = default)
    {
        await using var transaction =
            await _db.Database.BeginTransactionAsync(ct);

        var item = await _db.TrackedItems
            .SingleOrDefaultAsync(x => x.Id == id, ct);

        if (item is null)
        {
            return NotFound();
        }

        // TrackedItem itself may reference ItemSource through these FKs.
        // Clear them before deleting sources.
        item.CurrentSourceId = null;
        item.PreviousSourceId = null;

        await _db.SaveChangesAsync(ct);

        // Alerts reference item/history, so delete them before history.
        await _db.PriceAlertEvents
            .Where(x => x.ItemId == id)
            .ExecuteDeleteAsync(ct);

        // PriceHistory may reference ScrapeResult, so delete history
        // before deleting ScrapeResults.
        await _db.PriceHistory
            .Where(x => x.ItemId == id)
            .ExecuteDeleteAsync(ct);

        await _db.ScrapeResults
            .Where(x => x.ItemId == id)
            .ExecuteDeleteAsync(ct);

        await _db.ItemSources
            .Where(x => x.ItemId == id)
            .ExecuteDeleteAsync(ct);

        _db.TrackedItems.Remove(item);

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return NoContent();
    }

    // POST /api/items/{itemId}/sources
    [HttpPost("{itemId:guid}/sources")]
    public async Task<IActionResult> CreateSource(
        Guid itemId,
        [FromBody] CreateSourceRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateSource(
            request.Store,
            request.Url,
            request.DefaultQuantity,
            request.ManualPrice);

        if (validationError is not null)
        {
            return BadRequest(new { error = validationError });
        }

        var item = await _db.TrackedItems
            .SingleOrDefaultAsync(x => x.Id == itemId, ct);

        if (item is null)
        {
            return NotFound(new { error = "Item not found." });
        }

        if (item.ArchivedAt is not null)
        {
            return Conflict(new
            {
                error = "Cannot add a source to an archived item."
            });
        }

        var now = DateTimeOffset.UtcNow;

        var source = new ItemSource
        {
            ItemId = itemId,
            Store = request.Store.Trim(),
            Url = NormalizeOptional(request.Url),
            ScrapingEnabled = request.ScrapingEnabled,
            DefaultQuantity = request.DefaultQuantity,
            ManualPrice = request.ManualPrice,
            Note = NormalizeOptional(request.Note),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.ItemSources.Add(source);

        item.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);

        return Created(
            $"/api/items/{itemId}",
            new { source.Id });
    }

    // PUT /api/items/{itemId}/sources/{sourceId}
    [HttpPut("{itemId:guid}/sources/{sourceId:long}")]
    public async Task<IActionResult> UpdateSource(
        Guid itemId,
        long sourceId,
        [FromBody] UpdateSourceRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateSource(
            request.Store,
            request.Url,
            request.DefaultQuantity,
            request.ManualPrice);

        if (validationError is not null)
        {
            return BadRequest(new { error = validationError });
        }

        var source = await _db.ItemSources
            .SingleOrDefaultAsync(
                x => x.Id == sourceId && x.ItemId == itemId,
                ct);

        if (source is null)
        {
            return NotFound();
        }

        source.Store = request.Store.Trim();
        source.Url = NormalizeOptional(request.Url);
        source.ScrapingEnabled = request.ScrapingEnabled;
        source.DefaultQuantity = request.DefaultQuantity;
        source.ManualPrice = request.ManualPrice;
        source.Note = NormalizeOptional(request.Note);
        source.UpdatedAt = DateTimeOffset.UtcNow;

        var item = await _db.TrackedItems
            .SingleAsync(x => x.Id == itemId, ct);

        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);

        return NoContent();
    }

    // GET /api/items/{id}/offers
[HttpGet("{id:guid}/offers")]
public async Task<IActionResult> GetOffers(
    Guid id,
    CancellationToken ct = default)
{
    var item = await _db.TrackedItems
        .AsNoTracking()
        .Where(x => x.Id == id)
        .Select(x => new
        {
            x.Id,
            x.CurrentSourceId
        })
        .SingleOrDefaultAsync(ct);

    if (item is null)
    {
        return NotFound();
    }

    var sources = await _db.ItemSources
        .AsNoTracking()
        .Where(x => x.ItemId == id)
        .OrderBy(x => x.Store)
        .ToListAsync(ct);

    var sourceIds = sources
        .Select(x => x.Id)
        .ToArray();

    var acceptedResults =
        await _db.ScrapeResults
            .AsNoTracking()
            .Where(x =>
                x.ItemId == id &&
                x.SourceId.HasValue &&
                sourceIds.Contains(
                    x.SourceId.Value) &&
                (
                    x.ReviewStatus ==
                        ReviewStatus.NotRequired ||
                    x.ReviewStatus ==
                        ReviewStatus.Accepted ||
                    x.ReviewStatus ==
                        ReviewStatus.ManualOverride
                ))
            .OrderByDescending(
                x => x.CreatedAt)
            .Select(x => new
            {
                x.SourceId,
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ManualPrice,
                x.ManualQuantity,
                x.ReviewStatus,
                x.CreatedAt,
                x.ReviewedAt
            })
            .ToListAsync(ct);

    var latestBySource =
        acceptedResults
            .Where(x =>
                x.SourceId.HasValue)
            .GroupBy(x =>
                x.SourceId!.Value)
            .ToDictionary(
                group => group.Key,
                group => group.First());

    var offers = sources.Select(source =>
    {
        decimal? price = null;
        decimal? quantity = null;
        decimal? unitPrice = null;
        string? origin = null;
        DateTimeOffset? observedAt = null;

        // Long-lived manual source
        if (
            !source.ScrapingEnabled &&
            source.ManualPrice.HasValue)
        {
            price =
                source.ManualPrice.Value;

            quantity =
                source.DefaultQuantity;

            if (quantity > 0)
            {
                unitPrice =
                    price / quantity;
            }

            origin = "Manual";

            observedAt =
                source.UpdatedAt;
        }
        // Automatic source
        else if (
            latestBySource.TryGetValue(
                source.Id,
                out var result))
        {
            if (
                result.ReviewStatus ==
                    ReviewStatus.ManualOverride &&
                result.ManualPrice.HasValue &&
                result.ManualQuantity.HasValue &&
                result.ManualQuantity.Value > 0)
            {
                price =
                    result.ManualPrice.Value;

                quantity =
                    result.ManualQuantity.Value;

                unitPrice =
                    price / quantity;

                origin =
                    "Manual override";

                observedAt =
                    result.ReviewedAt ??
                    result.CreatedAt;
            }
            else if (
                result.ScrapedPrice.HasValue &&
                result.ScrapedQuantity.HasValue &&
                result.ScrapedQuantity.Value > 0)
            {
                price =
                    result.ScrapedPrice.Value;

                quantity =
                    result.ScrapedQuantity.Value;

                unitPrice =
                    price / quantity;

                origin =
                    result.ReviewStatus ==
                    ReviewStatus.Accepted
                        ? "Accepted scrape"
                        : "Automatic";

                observedAt =
                    result.ReviewedAt ??
                    result.CreatedAt;
            }
        }

        return new
        {
            SourceId = source.Id,
            source.Store,
            source.Url,
            source.Note,
            source.ScrapingEnabled,
            Origin = origin,
            Price = price,
            Quantity = quantity,
            UnitPrice = unitPrice,
            ObservedAt = observedAt,
            IsCurrent =
                item.CurrentSourceId ==
                source.Id
        };
    });

    return Ok(offers);
}

    private static string? ValidateItem(
        string name,
        string currency,
        decimal? targetPrice,
        decimal comparisonQuantity,
        int? checkIntervalMinutes)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Name is required.";
        }

        if (name.Trim().Length > 200)
        {
            return "Name is too long.";
        }

        if (string.IsNullOrWhiteSpace(currency))
        {
            return "Currency is required.";
        }

        if (currency.Trim().Length != 3)
        {
            return "Currency must be a 3-letter code, for example SEK.";
        }

        if (comparisonQuantity <= 0)
        {
            return "ComparisonQuantity must be greater than zero.";
        }

        if (targetPrice is < 0)
        {
            return "TargetPrice cannot be negative.";
        }

        if (checkIntervalMinutes is <= 0)
        {
            return "CheckIntervalMinutes must be greater than zero.";
        }

        return null;
    }

    private static string? ValidateSource(
        string store,
        string? url,
        decimal defaultQuantity,
        decimal? manualPrice)
    {
        if (string.IsNullOrWhiteSpace(store))
        {
            return "Store is required.";
        }

        if (defaultQuantity <= 0)
        {
            return "DefaultQuantity must be greater than zero.";
        }

        if (manualPrice is < 0)
        {
            return "ManualPrice cannot be negative.";
        }

        if (!string.IsNullOrWhiteSpace(url))
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return "Url must be a valid absolute URL.";
            }

            if (uri.Scheme != Uri.UriSchemeHttp &&
                uri.Scheme != Uri.UriSchemeHttps)
            {
                return "Url must use http or https.";
            }
        }

        return null;
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}
