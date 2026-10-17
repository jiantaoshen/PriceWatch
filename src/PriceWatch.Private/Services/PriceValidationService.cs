using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Private.Services;

public sealed record PriceValidationDecision(
    ScrapeResultStatus Status,
    string? SuspiciousReason,
    string? Error);

public sealed class PriceValidationService
{
    private readonly PriceWatchDbContext _db;
    private readonly PrivateSettings _settings;

    public PriceValidationService(
        PriceWatchDbContext db,
        IOptions<PrivateSettings> options)
    {
        _db = db;
        _settings = options.Value;
    }

    public async Task<PriceValidationDecision> ValidateAsync(
        TrackedItem item,
        ItemSource source,
        decimal price,
        decimal quantity,
        CancellationToken ct = default)
    {
        if (price < 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Failed,
                null,
                "Price cannot be negative.");
        }

        if (quantity <= 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Failed,
                null,
                "Quantity must be greater than zero.");
        }

        var currentUnitPrice = price / quantity;

        var previous = await _db.PriceObservations
            .AsNoTracking()
            .Where(x => x.SourceId == source.Id)
            .OrderByDescending(x => x.ObservedAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new
            {
                x.Price,
                x.Quantity
            })
            .FirstOrDefaultAsync(ct);

        decimal? baselineUnitPrice = previous is not null && previous.Quantity > 0
            ? previous.Price / previous.Quantity
            : null;

        if (!baselineUnitPrice.HasValue &&
            item.CurrentPrice.HasValue &&
            item.CurrentQuantity.HasValue &&
            item.CurrentQuantity.Value > 0)
        {
            baselineUnitPrice =
                item.CurrentPrice.Value /
                item.CurrentQuantity.Value;
        }

        if (!baselineUnitPrice.HasValue || baselineUnitPrice.Value <= 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Success,
                null,
                null);
        }

        var changeRatio =
            Math.Abs(currentUnitPrice - baselineUnitPrice.Value) /
            baselineUnitPrice.Value;

        if (changeRatio > _settings.SuspiciousChangeRatio)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Suspicious,
                $"Normalized unit price changed by {changeRatio:P1}; " +
                $"threshold is {_settings.SuspiciousChangeRatio:P0}.",
                null);
        }

        return new PriceValidationDecision(
            ScrapeResultStatus.Success,
            null,
            null);
    }
}
