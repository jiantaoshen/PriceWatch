using System.IO.Compression;
using System.Text.Json;

namespace PriceWatch.Migrator;

internal sealed class LegacyBundle
{
    public required List<LegacyProduct> Products { get; init; }

    public required List<LegacyProduct> Subscriptions { get; init; }

    public required List<LegacyHistoryFile> History { get; init; }

    public required LegacyLatestFile Latest { get; init; }

    public required List<LegacyRun> Runs { get; init; }

    public LegacySchedule? Schedule { get; init; }

    public static LegacyBundle Load(
        string zipPath)
    {
        using var archive =
            ZipFile.OpenRead(zipPath);

        var jsonOptions =
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive =
                    true
            };

        jsonOptions.Converters.Add(
            new UtcDateTimeOffsetJsonConverter());

        T Read<T>(
            string name)
        {
            var entry =
                archive.GetEntry(name)
                ?? throw new InvalidDataException(
                    $"Missing legacy file: {name}");

            using var stream =
                entry.Open();

            return JsonSerializer
                .Deserialize<T>(
                    stream,
                    jsonOptions)
                ?? throw new InvalidDataException(
                    $"Could not deserialize {name}");
        }

        T? ReadOptional<T>(
            string name)
        {
            var entry =
                archive.GetEntry(name);

            if (entry is null)
            {
                return default;
            }

            using var stream =
                entry.Open();

            return JsonSerializer
                .Deserialize<T>(
                    stream,
                    jsonOptions);
        }

        var history =
            archive.Entries
                .Where(entry =>
                    entry.FullName.StartsWith(
                        "data/history/",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    entry.FullName.EndsWith(
                        ".json",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    !entry.FullName.EndsWith(
                        "/index.json",
                        StringComparison.OrdinalIgnoreCase))
                .OrderBy(entry =>
                    entry.FullName,
                    StringComparer.OrdinalIgnoreCase)
                .Select(entry =>
                {
                    using var stream =
                        entry.Open();

                    return JsonSerializer
                        .Deserialize<LegacyHistoryFile>(
                            stream,
                            jsonOptions)
                        ?? throw new InvalidDataException(
                            $"Could not deserialize {entry.FullName}");
                })
                .OrderBy(x => x.GeneratedAt)
                .ToList();

        var runs =
            archive.Entries
                .Where(entry =>
                    entry.FullName.StartsWith(
                        "data/runs/",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    entry.FullName.EndsWith(
                        ".json",
                        StringComparison.OrdinalIgnoreCase)
                    &&
                    !entry.FullName.EndsWith(
                        "/latest.json",
                        StringComparison.OrdinalIgnoreCase))
                .OrderBy(entry =>
                    entry.FullName,
                    StringComparer.OrdinalIgnoreCase)
                .Select(entry =>
                {
                    using var stream =
                        entry.Open();

                    return JsonSerializer
                        .Deserialize<LegacyRun>(
                            stream,
                            jsonOptions)
                        ?? throw new InvalidDataException(
                            $"Could not deserialize {entry.FullName}");
                })
                .OrderBy(x => x.StartedAt)
                .ToList();

        return new LegacyBundle
        {
            Products =
                Read<List<LegacyProduct>>(
                    "data/products.json"),

            Subscriptions =
                ReadOptional<List<LegacyProduct>>(
                    "data/subscriptions.json")
                ?? [],

            History =
                history,

            Latest =
                Read<LegacyLatestFile>(
                    "data/latest.json"),

            Runs =
                runs,

            Schedule =
                ReadOptional<LegacySchedule>(
                    "data/settings/schedule.json")
        };
    }
}
