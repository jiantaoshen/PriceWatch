using System.Security.Cryptography;
using System.Text;

namespace PriceWatch.Migrator;

internal static class LegacyIds
{
    public static Guid ForItem(
        string legacyId)
    {
        return Create(
            $"pricewatch:legacy:item:{legacyId}");
    }

    public static Guid ForRun(
        string legacyRunId)
    {
        return Create(
            $"pricewatch:legacy:run:{legacyRunId}");
    }

    private static Guid Create(
        string value)
    {
        var bytes =
            SHA256.HashData(
                Encoding.UTF8.GetBytes(value));

        var guidBytes =
            bytes[..16];

        // Make it look like a standards-compliant
        // deterministic UUID (version 5 / RFC variant).
        guidBytes[6] =
            (byte)(
                (guidBytes[6] & 0x0F) |
                0x50);

        guidBytes[8] =
            (byte)(
                (guidBytes[8] & 0x3F) |
                0x80);

        return new Guid(guidBytes);
    }
}

internal static class DecimalHelpers
{
    public static bool Equal(
        decimal a,
        decimal b)
    {
        return decimal.Round(
                   a,
                   6,
                   MidpointRounding.AwayFromZero)
               ==
               decimal.Round(
                   b,
                   6,
                   MidpointRounding.AwayFromZero);
    }
}
