namespace PriceWatch.Private.Models;

public sealed record EmailSettingsResponse(
    bool Enabled,
    string SmtpHost,
    int SmtpPort,
    bool UseSsl,
    int TimeoutSeconds,
    string Username,
    bool PasswordConfigured,
    string From,
    string To);

public sealed record UpdateEmailSettingsRequest(
    bool Enabled,
    string SmtpHost,
    int SmtpPort,
    bool UseSsl,
    int TimeoutSeconds,
    string Username,
    string? Password,
    bool ClearPassword,
    string From,
    string To);
