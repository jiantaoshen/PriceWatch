namespace PriceWatch.Private;

public sealed class EmailAlertSettings
{
    public bool Enabled { get; set; }

    public string SmtpHost { get; set; } = string.Empty;

    public int SmtpPort { get; set; } = 587;

    public bool UseSsl { get; set; } = true;

    public int TimeoutSeconds { get; set; } = 30;

    public string Username { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string From { get; set; } = string.Empty;

    public string To { get; set; } = string.Empty;
}
