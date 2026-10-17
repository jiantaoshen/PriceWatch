using System.Net.Mail;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using PriceWatch.Private.Models;

namespace PriceWatch.Private.Services;

public sealed class EmailAlertSettingsStore
{
    private const string ProtectionPurpose = "PriceWatch.Private.EmailAlertSettings.v1";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly PrivatePaths _paths;
    private readonly EmailAlertSettings _bootstrapSettings;
    private readonly IDataProtector _protector;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public EmailAlertSettingsStore(
        PrivatePaths paths,
        IOptions<EmailAlertSettings> bootstrapSettings,
        IDataProtectionProvider dataProtectionProvider)
    {
        _paths = paths;
        _bootstrapSettings = Clone(bootstrapSettings.Value);
        _protector = dataProtectionProvider.CreateProtector(ProtectionPurpose);
    }

    public async Task<EmailAlertSettings> GetAsync(
        CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            return await ReadUnlockedAsync(ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<EmailSettingsResponse> GetResponseAsync(
        CancellationToken ct = default)
    {
        var settings = await GetAsync(ct);
        return ToResponse(settings);
    }

    public async Task<EmailSettingsResponse> SaveAsync(
        UpdateEmailSettingsRequest request,
        CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var current = await ReadUnlockedAsync(ct);
            var password = request.ClearPassword
                ? string.Empty
                : !string.IsNullOrWhiteSpace(request.Password)
                    ? request.Password
                    : current.Password;

            var next = new EmailAlertSettings
            {
                Enabled = request.Enabled,
                SmtpHost = request.SmtpHost?.Trim() ?? string.Empty,
                SmtpPort = request.SmtpPort,
                UseSsl = request.UseSsl,
                TimeoutSeconds = request.TimeoutSeconds,
                Username = request.Username?.Trim() ?? string.Empty,
                Password = password,
                From = request.From?.Trim() ?? string.Empty,
                To = request.To?.Trim() ?? string.Empty
            };

            if (string.IsNullOrWhiteSpace(next.Username))
            {
                next.Password = string.Empty;
            }

            Validate(next);
            await WriteUnlockedAsync(next, ct);

            return ToResponse(next);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<EmailAlertSettings> ReadUnlockedAsync(
        CancellationToken ct)
    {
        if (!File.Exists(_paths.EmailSettingsFile))
        {
            return Clone(_bootstrapSettings);
        }

        await using var stream = new FileStream(
            _paths.EmailSettingsFile,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 4096,
            useAsync: true);

        var stored = await JsonSerializer.DeserializeAsync<StoredEmailSettings>(
            stream,
            JsonOptions,
            ct)
            ?? throw new InvalidOperationException(
                "Stored email settings are invalid.");

        var password = string.Empty;
        if (!string.IsNullOrWhiteSpace(stored.ProtectedPassword))
        {
            try
            {
                password = _protector.Unprotect(stored.ProtectedPassword);
            }
            catch (CryptographicException)
            {
                throw new InvalidOperationException(
                    "Stored email credentials cannot be decrypted.");
            }
        }

        return new EmailAlertSettings
        {
            Enabled = stored.Enabled,
            SmtpHost = stored.SmtpHost ?? string.Empty,
            SmtpPort = stored.SmtpPort,
            UseSsl = stored.UseSsl,
            TimeoutSeconds = stored.TimeoutSeconds,
            Username = stored.Username ?? string.Empty,
            Password = password,
            From = stored.From ?? string.Empty,
            To = stored.To ?? string.Empty
        };
    }

    private async Task WriteUnlockedAsync(
        EmailAlertSettings settings,
        CancellationToken ct)
    {
        Directory.CreateDirectory(_paths.SettingsDirectory);

        var stored = new StoredEmailSettings
        {
            Enabled = settings.Enabled,
            SmtpHost = settings.SmtpHost,
            SmtpPort = settings.SmtpPort,
            UseSsl = settings.UseSsl,
            TimeoutSeconds = settings.TimeoutSeconds,
            Username = settings.Username,
            ProtectedPassword = string.IsNullOrWhiteSpace(settings.Password)
                ? null
                : _protector.Protect(settings.Password),
            From = settings.From,
            To = settings.To
        };

        var tempPath = _paths.EmailSettingsFile + ".tmp";

        await using (var stream = new FileStream(
            tempPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4096,
            useAsync: true))
        {
            await JsonSerializer.SerializeAsync(
                stream,
                stored,
                JsonOptions,
                ct);
            await stream.FlushAsync(ct);
        }

        File.Move(tempPath, _paths.EmailSettingsFile, overwrite: true);
    }

    private static void Validate(EmailAlertSettings settings)
    {
        if (settings.SmtpPort is < 1 or > 65535)
        {
            throw new ArgumentException(
                "SMTP port must be between 1 and 65535.");
        }

        if (settings.TimeoutSeconds is < 1 or > 300)
        {
            throw new ArgumentException(
                "SMTP timeout must be between 1 and 300 seconds.");
        }

        if (!settings.Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(settings.SmtpHost) ||
            string.IsNullOrWhiteSpace(settings.From) ||
            string.IsNullOrWhiteSpace(settings.To))
        {
            throw new ArgumentException(
                "SMTP host, sender, and recipient are required when email alerts are enabled.");
        }

        var hasUsername = !string.IsNullOrWhiteSpace(settings.Username);
        var hasPassword = !string.IsNullOrWhiteSpace(settings.Password);
        if (hasUsername != hasPassword)
        {
            throw new ArgumentException(
                "SMTP username and password must either both be configured or both be empty.");
        }

        try
        {
            _ = new MailAddress(settings.From);

            var recipients = settings.To.Split(
                new[] { ',', ';' },
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (recipients.Length == 0)
            {
                throw new FormatException();
            }

            foreach (var recipient in recipients)
            {
                _ = new MailAddress(recipient);
            }
        }
        catch (FormatException)
        {
            throw new ArgumentException(
                "Sender or recipient email address is invalid.");
        }
    }

    private static EmailSettingsResponse ToResponse(
        EmailAlertSettings settings) =>
        new(
            settings.Enabled,
            settings.SmtpHost,
            settings.SmtpPort,
            settings.UseSsl,
            settings.TimeoutSeconds,
            settings.Username,
            !string.IsNullOrWhiteSpace(settings.Password),
            settings.From,
            settings.To);

    private static EmailAlertSettings Clone(
        EmailAlertSettings source) =>
        new()
        {
            Enabled = source.Enabled,
            SmtpHost = source.SmtpHost,
            SmtpPort = source.SmtpPort,
            UseSsl = source.UseSsl,
            TimeoutSeconds = source.TimeoutSeconds,
            Username = source.Username,
            Password = source.Password,
            From = source.From,
            To = source.To
        };

    private sealed class StoredEmailSettings
    {
        public bool Enabled { get; set; }

        public string? SmtpHost { get; set; }

        public int SmtpPort { get; set; } = 587;

        public bool UseSsl { get; set; } = true;

        public int TimeoutSeconds { get; set; } = 30;

        public string? Username { get; set; }

        public string? ProtectedPassword { get; set; }

        public string? From { get; set; }

        public string? To { get; set; }
    }
}
