using System.Text.RegularExpressions;

namespace PriceWatch.Private.Infrastructure;

public static partial class SensitiveDataRedactor
{
    public static string Redact(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var redacted = PostgresUriCredentialsRegex().Replace(
            value,
            "${scheme}${user}:***@${host}");

        redacted = PasswordKeyValueRegex().Replace(
            redacted,
            "${prefix}***");

        redacted = AuthorizationBearerRegex().Replace(
            redacted,
            "${prefix}***");

        redacted = SensitiveQueryParameterRegex().Replace(
            redacted,
            "${prefix}***");

        return redacted;
    }

    [GeneratedRegex(
        @"(?<scheme>postgres(?:ql)?://)(?<user>[^:\s/@]+):[^@\s]+@(?<host>[^\s/]+)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PostgresUriCredentialsRegex();

    [GeneratedRegex(
        @"(?<prefix>\b(?:Password|Pwd)\s*=\s*)[^;\r\n]*",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PasswordKeyValueRegex();

    [GeneratedRegex(
        @"(?<prefix>\bAuthorization\s*:\s*Bearer\s+)[^\s,;]+",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AuthorizationBearerRegex();

    [GeneratedRegex(
        @"(?<prefix>[?&](?:access_token|token|api_key|apikey|password|pwd)=)[^&#\s]+",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SensitiveQueryParameterRegex();
}
