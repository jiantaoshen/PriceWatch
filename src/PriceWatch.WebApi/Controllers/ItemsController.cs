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
[Route("api/items")]
public class ItemsController : ControllerBase
{
    private readonly PriceWatchDbContext _db;
    private readonly PriceTrackingService _prices;

    public ItemsController(
        PriceWatchDbContext db,
        PriceTrackingService prices)
    {
        _db = db;
        _prices = prices;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool includeArchived = false,
        CancellationToken ct = default)
    {
        var query = _db.TrackedItems
            .AsNoTracking()
            .Include(x => x.Sources)
            .AsQueryable();

        if (!includeArchived)
            query = query.Where(x => x.ArchivedAt == null);

        var items = await query
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var itemIds = items.Select(x => x.Id).ToArray();
        var states = await _db.BestPriceStates
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

        var response = items.Select(item =>
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
                item.LastSuccessfulPriceAt,
                item.LastPriceChangedAt,
                item.ArchivedAt,
                MonthlyPrice = item.ItemType == ItemType.Subscription
                    ? item.CurrentUnitPrice
                    : null
            };
        });

        return Ok(response);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(
        Guid id,
        CancellationToken ct = default)
    {
        var item = await _db.TrackedItems
            .AsNoTracking()
            .Include(x => x.Sources)
            .SingleOrDefaultAsync(x => x.Id == id, ct);

        if (item is null)
            return NotFound();

        var state = await _db.BestPriceStates
            .AsNoTracking()
            .Include(x => x.Sources)
                .ThenInclude(x => x.Source)
            .Where(x => x.ItemId == id)
            .OrderByDescending(x => x.RecordedAt)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        return Ok(new
        {
            item.Id,
            item.ItemType,
            item.Name,
            item.Currency,
            item.Unit,
            item.TargetPrice,
            item.ComparisonQuantity,
            item.TargetUnitPrice,
            item.CurrentPrice,
            item.CurrentQuantity,
            item.CurrentUnitPrice,
            CurrentStores = item.CurrentUnitPrice.HasValue
                ? state?.Sources
                    .Where(x => x.Source.ArchivedAt == null)
                    .Select(x => x.Source.Store)
                    .OrderBy(x => x)
                    .ToArray() ?? []
                : [],
            item.PreviousPrice,
            item.PreviousQuantity,
            item.PreviousUnitPrice,
            item.CheckIntervalMinutes,
            item.TrackingEnabled,
            item.LastCheckedAt,
            item.LastSuccessfulPriceAt,
            item.LastPriceChangedAt,
            item.ArchivedAt,
            item.CreatedAt,
            item.UpdatedAt,
            Sources = item.Sources
                .OrderBy(x => x.ArchivedAt.HasValue)
                .ThenBy(x => x.Store)
                .Select(source => new
                {
                    source.Id,
                    source.Store,
                    source.Url,
                    source.ScrapingEnabled,
                    source.DefaultQuantity,
                    source.Note,
                    source.ArchivedAt,
                    source.CreatedAt,
                    source.UpdatedAt
                })
                .ToList()
        });
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(
        Guid id,
        [FromQuery] DateTimeOffset? from,
        CancellationToken ct = default)
    {
        if (!await _db.TrackedItems.AsNoTracking().AnyAsync(x => x.Id == id, ct))
            return NotFound();

        var query = _db.BestPriceStates
            .AsNoTracking()
            .Include(x => x.Sources)
                .ThenInclude(x => x.Source)
            .Where(x => x.ItemId == id);

        if (from.HasValue)
            query = query.Where(x => x.RecordedAt >= from.Value);

        var states = await query
            .OrderBy(x => x.RecordedAt)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);

        return Ok(states.Select(state => new
        {
            state.RecordedAt,
            state.UnitPrice,
            Stores = state.Sources
                .Select(x => x.Source.Store)
                .OrderBy(x => x)
                .ToArray()
        }));
    }

    [HttpGet("{id:guid}/offers")]
    public async Task<IActionResult> GetOffers(
        Guid id,
        CancellationToken ct = default)
    {
        if (!await _db.TrackedItems.AsNoTracking().AnyAsync(x => x.Id == id, ct))
            return NotFound();

        return Ok(await _prices.GetEffectiveOffersAsync(id, false, ct));
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateItemRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateItem(request);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var now = DateTimeOffset.UtcNow;
        var item = new TrackedItem
        {
            ItemType = request.ItemType,
            Name = request.Name.Trim(),
            Currency = request.Currency.Trim().ToUpperInvariant(),
            Unit = NormalizeOptional(request.Unit),
            TargetPrice = request.TargetPrice,
            ComparisonQuantity = request.ComparisonQuantity,
            CheckIntervalMinutes = request.CheckIntervalMinutes,
            TrackingEnabled = request.TrackingEnabled,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.TrackedItems.Add(item);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, new { item.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateItemRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateItem(request);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var item = await _db.TrackedItems.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return NotFound();

        item.ItemType = request.ItemType;
        item.Name = request.Name.Trim();
        item.Currency = request.Currency.Trim().ToUpperInvariant();
        item.Unit = NormalizeOptional(request.Unit);
        item.TargetPrice = request.TargetPrice;
        item.ComparisonQuantity = request.ComparisonQuantity;
        item.CheckIntervalMinutes = request.CheckIntervalMinutes;
        item.TrackingEnabled = request.TrackingEnabled;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct = default)
    {
        var item = await _db.TrackedItems.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return NotFound();

        item.ArchivedAt = DateTimeOffset.UtcNow;
        item.TrackingEnabled = false;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct = default)
    {
        var item = await _db.TrackedItems.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return NotFound();

        item.ArchivedAt = null;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var item = await _db.TrackedItems.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (item is null)
            return NotFound();

        var stateIds = await _db.BestPriceStates
            .Where(x => x.ItemId == id)
            .Select(x => x.Id)
            .ToListAsync(ct);

        await _db.PriceAlertEvents.Where(x => x.ItemId == id).ExecuteDeleteAsync(ct);
        await _db.BestPriceStateSources
            .Where(x => stateIds.Contains(x.BestPriceStateId))
            .ExecuteDeleteAsync(ct);
        await _db.BestPriceStates.Where(x => x.ItemId == id).ExecuteDeleteAsync(ct);
        await _db.PriceObservations.Where(x => x.ItemId == id).ExecuteDeleteAsync(ct);
        await _db.ScrapeResults.Where(x => x.ItemId == id).ExecuteDeleteAsync(ct);
        await _db.ItemSources.Where(x => x.ItemId == id).ExecuteDeleteAsync(ct);

        _db.TrackedItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return NoContent();
    }

    [HttpPost("{itemId:guid}/sources")]
    public async Task<IActionResult> CreateSource(
        Guid itemId,
        [FromBody] CreateSourceRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateSource(request);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var item = await _db.TrackedItems.SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null)
            return NotFound(new { error = "Item not found." });

        if (item.ArchivedAt is not null)
            return Conflict(new { error = "Cannot add a source to an archived item." });

        var now = DateTimeOffset.UtcNow;
        var source = new ItemSource
        {
            ItemId = itemId,
            Store = request.Store.Trim(),
            Url = NormalizeOptional(request.Url),
            ScrapingEnabled = request.ScrapingEnabled,
            DefaultQuantity = request.DefaultQuantity,
            Note = NormalizeOptional(request.Note),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.ItemSources.Add(source);
        item.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);

        return Created($"/api/items/{itemId}", new { source.Id });
    }

    [HttpPut("{itemId:guid}/sources/{sourceId:long}")]
    public async Task<IActionResult> UpdateSource(
        Guid itemId,
        long sourceId,
        [FromBody] UpdateSourceRequest request,
        CancellationToken ct = default)
    {
        var validationError = ValidateSource(request);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var source = await _db.ItemSources
            .SingleOrDefaultAsync(x => x.Id == sourceId && x.ItemId == itemId, ct);
        if (source is null)
            return NotFound();

        source.Store = request.Store.Trim();
        source.Url = NormalizeOptional(request.Url);
        source.ScrapingEnabled = request.ScrapingEnabled;
        source.DefaultQuantity = request.DefaultQuantity;
        source.Note = NormalizeOptional(request.Note);
        source.UpdatedAt = DateTimeOffset.UtcNow;

        var item = await _db.TrackedItems.SingleAsync(x => x.Id == itemId, ct);
        item.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{itemId:guid}/sources/{sourceId:long}/archive")]
    public async Task<IActionResult> ArchiveSource(
        Guid itemId,
        long sourceId,
        CancellationToken ct = default)
    {
        var source = await _db.ItemSources
            .SingleOrDefaultAsync(x => x.Id == sourceId && x.ItemId == itemId, ct);
        if (source is null)
            return NotFound();

        if (source.ArchivedAt is null)
        {
            source.ArchivedAt = DateTimeOffset.UtcNow;
            source.UpdatedAt = source.ArchivedAt.Value;
            await _db.SaveChangesAsync(ct);
            await _prices.RecalculateBestPriceAsync(
                itemId,
                BestPriceChangeCause.SourceChange,
                source.ArchivedAt.Value,
                ct);
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    [HttpPost("{itemId:guid}/sources/{sourceId:long}/restore")]
    public async Task<IActionResult> RestoreSource(
        Guid itemId,
        long sourceId,
        CancellationToken ct = default)
    {
        var source = await _db.ItemSources
            .SingleOrDefaultAsync(x => x.Id == sourceId && x.ItemId == itemId, ct);
        if (source is null)
            return NotFound();

        if (source.ArchivedAt is not null)
        {
            var now = DateTimeOffset.UtcNow;
            source.ArchivedAt = null;
            source.UpdatedAt = now;
            await _db.SaveChangesAsync(ct);
            await _prices.RecalculateBestPriceAsync(
                itemId,
                BestPriceChangeCause.SourceChange,
                now,
                ct);
            await _db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    [HttpPost("{itemId:guid}/sources/{sourceId:long}/manual-price")]
    public async Task<IActionResult> AddManualPrice(
        Guid itemId,
        long sourceId,
        [FromBody] ManualObservationRequest request,
        CancellationToken ct = default)
    {
        if (request.Price < 0)
            return BadRequest(new { error = "Price cannot be negative." });
        if (request.Quantity <= 0)
            return BadRequest(new { error = "Quantity must be greater than zero." });

        var source = await _db.ItemSources
            .AsNoTracking()
            .SingleOrDefaultAsync(x =>
                x.Id == sourceId &&
                x.ItemId == itemId &&
                x.ArchivedAt == null,
                ct);

        if (source is null)
            return NotFound();

        var hasPendingReview = await _db.ScrapeResults
            .AsNoTracking()
            .AnyAsync(x =>
                x.SourceId == sourceId &&
                x.ReviewStatus == ReviewStatus.Pending,
                ct);

        if (hasPendingReview)
        {
            return Conflict(new
            {
                error = "This source has a pending review. Resolve it from Reviews before entering a manual price here.",
                reason = "pending_review"
            });
        }

        var now = DateTimeOffset.UtcNow;
        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        _prices.AddObservation(
            itemId,
            sourceId,
            request.Price,
            request.Quantity,
            PriceOrigin.Manual,
            now);

        await _db.SaveChangesAsync(ct);
        await _prices.RecalculateBestPriceAsync(
            itemId,
            BestPriceChangeCause.Manual,
            now,
            ct);
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return NoContent();
    }

    private static string? ValidateItem(CreateItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Name is required.";
        if (request.Name.Trim().Length > 500)
            return "Name is too long.";
        if (string.IsNullOrWhiteSpace(request.Currency) || request.Currency.Trim().Length != 3)
            return "Currency must be a 3-letter code, for example SEK.";
        if (request.ComparisonQuantity <= 0)
            return "ComparisonQuantity must be greater than zero.";
        if (request.TargetPrice is < 0)
            return "TargetPrice cannot be negative.";
        if (request.CheckIntervalMinutes is <= 0)
            return "CheckIntervalMinutes must be greater than zero.";
        return null;
    }

    private static string? ValidateSource(CreateSourceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Store))
            return "Store is required.";
        if (request.DefaultQuantity <= 0)
            return "DefaultQuantity must be greater than zero.";
        if (request.ScrapingEnabled && string.IsNullOrWhiteSpace(request.Url))
            return "Url is required when scraping is enabled.";

        if (!string.IsNullOrWhiteSpace(request.Url))
        {
            if (!Uri.TryCreate(request.Url, UriKind.Absolute, out var uri))
                return "Url must be a valid absolute URL.";
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                return "Url must use http or https.";
        }

        return null;
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
