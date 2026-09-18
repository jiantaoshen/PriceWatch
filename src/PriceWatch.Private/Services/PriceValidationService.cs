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
        if (price <= 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Failed,
                null,
                "Price must be greater than zero.");
        }

        if (quantity <= 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Failed,
                null,
                "Quantity must be greater than zero.");
        }

        var currentUnitPrice = price / quantity;

        var previous = await _db.ScrapeResults
            .AsNoTracking()
            .Where(x =>
                x.SourceId == source.Id &&
                (
                    x.ReviewStatus == ReviewStatus.NotRequired ||
                    x.ReviewStatus == ReviewStatus.Accepted ||
                    x.ReviewStatus == ReviewStatus.ManualOverride
                ))
            .OrderByDescending(x => x.ReviewedAt ?? x.CreatedAt)
            .Select(x => new
            {
                x.ScrapedPrice,
                x.ScrapedQuantity,
                x.ManualPrice,
                x.ManualQuantity,
                x.ReviewStatus
            })
            .FirstOrDefaultAsync(ct);

        decimal? previousUnitPrice = null;

        if (previous is not null)
        {
            if (
                previous.ReviewStatus == ReviewStatus.ManualOverride &&
                previous.ManualPrice.HasValue &&
                previous.ManualQuantity.HasValue &&
                previous.ManualQuantity.Value > 0)
            {
                previousUnitPrice =
                    previous.ManualPrice.Value /
                    previous.ManualQuantity.Value;
            }
            else if (
                previous.ScrapedPrice.HasValue &&
                previous.ScrapedQuantity.HasValue &&
                previous.ScrapedQuantity.Value > 0)
            {
                previousUnitPrice =
                    previous.ScrapedPrice.Value /
                    previous.ScrapedQuantity.Value;
            }
        }

        if (
            !previousUnitPrice.HasValue &&
            item.CurrentSourceId == source.Id &&
            item.CurrentPrice.HasValue &&
            item.CurrentQuantity.HasValue &&
            item.CurrentQuantity.Value > 0)
        {
            previousUnitPrice =
                item.CurrentPrice.Value /
                item.CurrentQuantity.Value;
        }

        if (!previousUnitPrice.HasValue || previousUnitPrice.Value <= 0)
        {
            return new PriceValidationDecision(
                ScrapeResultStatus.Success,
                null,
                null);
        }

        var changeRatio =
            Math.Abs(currentUnitPrice - previousUnitPrice.Value) /
            previousUnitPrice.Value;

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
