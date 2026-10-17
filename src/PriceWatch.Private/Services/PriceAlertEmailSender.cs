using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Private.Services;

public sealed class PriceAlertEmailSender
{
    private const int BatchSize = 50;

    private readonly PriceWatchDbContext _db;
    private readonly EmailAlertSettingsStore _settingsStore;
    private readonly ILogger<PriceAlertEmailSender> _logger;

    public PriceAlertEmailSender(
        PriceWatchDbContext db,
        EmailAlertSettingsStore settingsStore,
        ILogger<PriceAlertEmailSender> logger)
    {
        _db = db;
        _settingsStore = settingsStore;
        _logger = logger;
    }

    public async Task<int> SendOutstandingAsync(
        CancellationToken ct = default)
    {
        var settings = await _settingsStore.GetAsync(ct);
        if (!settings.Enabled)
        {
            return 0;
        }

        var alerts = await _db.PriceAlertEvents
            .Include(x => x.Item)
            .Include(x => x.BestPriceState)
                .ThenInclude(x => x.Sources)
                    .ThenInclude(x => x.Source)
            .Where(x =>
                (x.Status == AlertStatus.Pending || x.Status == AlertStatus.Failed) &&
                x.BestPriceState.Cause == BestPriceChangeCause.Automatic &&
                x.UnitPrice <= x.TargetUnitPrice)
            .OrderBy(x => x.CreatedAt)
            .ThenBy(x => x.Id)
            .Take(BatchSize)
            .ToListAsync(ct);

        var sent = 0;

        foreach (var alert in alerts)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                using var message = BuildMessage(settings, alert);
                using var client = BuildClient(settings);

                await client.SendMailAsync(message, ct);

                alert.Status = AlertStatus.Sent;
                alert.SentAt = DateTimeOffset.UtcNow;
                alert.Error = null;
                await _db.SaveChangesAsync(ct);

                sent++;

                _logger.LogInformation(
                    "Sent price alert {AlertId} for item {ItemId} and best-price state {BestPriceStateId}.",
                    alert.Id,
                    alert.ItemId,
                    alert.BestPriceStateId);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception exception)
            {
                var errorId = Guid.NewGuid();

                alert.Status = AlertStatus.Failed;
                alert.SentAt = null;
                alert.Error = $"Email delivery failed. Error ID: {errorId}";
                await _db.SaveChangesAsync(CancellationToken.None);

                // Avoid logging exception.Message because SMTP/provider errors can
                // contain account or server details. The type and stack are enough
                // to correlate with the generic Error ID stored on the alert.
                _logger.LogError(
                    "Price alert delivery failed. ErrorId={ErrorId}, AlertId={AlertId}, Type={ExceptionType}, StackTrace={StackTrace}",
                    errorId,
                    alert.Id,
                    exception.GetType().FullName,
                    exception.StackTrace);

                // SMTP failures are usually account/server-wide. Stop this batch
                // so one outage cannot block a scrape run for N x timeout.
                break;
            }
        }

        return sent;
    }

    public async Task SendTestAsync(
        CancellationToken ct = default)
    {
        var settings = await _settingsStore.GetAsync(ct);
        if (!settings.Enabled)
        {
            throw new InvalidOperationException(
                "Email alerts must be enabled before sending a test message.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(settings.From),
            Subject = "[PriceWatch] Test email",
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false,
            Body = string.Join(
                Environment.NewLine,
                new[]
                {
                    "PriceWatch email alerts are configured correctly.",
                    $"Sent at (UTC): {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss} UTC"
                })
        };

        foreach (var recipient in SplitRecipients(settings.To))
        {
            message.To.Add(recipient);
        }

        using var client = BuildClient(settings);
        await client.SendMailAsync(message, ct);
    }

    private static SmtpClient BuildClient(
        EmailAlertSettings settings)
    {
        var client = new SmtpClient(settings.SmtpHost, settings.SmtpPort)
        {
            EnableSsl = settings.UseSsl,
            UseDefaultCredentials = false,
            Timeout = checked(settings.TimeoutSeconds * 1000)
        };

        if (!string.IsNullOrWhiteSpace(settings.Username))
        {
            client.Credentials = new NetworkCredential(
                settings.Username,
                settings.Password);
        }

        return client;
    }

    private static MailMessage BuildMessage(
        EmailAlertSettings settings,
        PriceAlertEvent alert)
    {
        var stores = alert.BestPriceState.Sources
            .Select(x => x.Source.Store)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var currency = alert.Item.Currency;
        var unitSuffix = string.IsNullOrWhiteSpace(alert.Item.Unit)
            ? string.Empty
            : $" / {SingleLine(alert.Item.Unit)}";

        var current = FormatPrice(alert.UnitPrice, currency, unitSuffix);
        var target = FormatPrice(alert.TargetUnitPrice, currency, unitSuffix);

        var message = new MailMessage
        {
            From = new MailAddress(settings.From),
            Subject = $"[PriceWatch] {SingleLine(alert.Item.Name)}: {current}",
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false,
            Body = string.Join(
                Environment.NewLine,
                new[]
                {
                    $"Product: {alert.Item.Name}",
                    $"Current lowest price: {current}",
                    $"Target price: {target}",
                    $"Lowest store(s): {(stores.Length == 0 ? "Unknown" : string.Join(", ", stores))}",
                    $"Price state time (UTC): {alert.BestPriceState.RecordedAt:yyyy-MM-dd HH:mm:ss} UTC"
                })
        };

        foreach (var recipient in SplitRecipients(settings.To))
        {
            message.To.Add(recipient);
        }

        return message;
    }

    private static IEnumerable<string> SplitRecipients(string value) =>
        value.Split(
            new[] { ',', ';' },
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string SingleLine(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');

    private static string FormatPrice(
        decimal value,
        string currency,
        string unitSuffix) =>
        $"{value.ToString("0.######", CultureInfo.InvariantCulture)} {currency}{unitSuffix}";
}
