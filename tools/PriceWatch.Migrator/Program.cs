using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PriceWatch.Data;

namespace PriceWatch.Migrator;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            var options = ImportOptions.Parse(args);

            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile(
                    "appsettings.json",
                    optional: true,
                    reloadOnChange: false)
                .AddUserSecrets<ProgramMarker>(
                    optional: true)
                .AddEnvironmentVariables()
                .Build();

            var connectionString =
                configuration.GetConnectionString("Database")
                ?? Environment.GetEnvironmentVariable(
                    "PRICEWATCH_DATABASE");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                Console.Error.WriteLine(
                    "Database connection string is missing.");
                Console.Error.WriteLine();
                Console.Error.WriteLine(
                    "Set it once with:");
                Console.Error.WriteLine(
                    "dotnet user-secrets init --project tools/PriceWatch.Migrator");
                Console.Error.WriteLine(
                    "dotnet user-secrets set \"ConnectionStrings:Database\" \"YOUR_NEON_CONNECTION_STRING\" --project tools/PriceWatch.Migrator");

                return 2;
            }

            var dbOptions =
                new DbContextOptionsBuilder<PriceWatchDbContext>()
                    .UseNpgsql(connectionString)
                    .UseSnakeCaseNamingConvention()
                    .Options;

            await using var db =
                new PriceWatchDbContext(dbOptions);

            Console.WriteLine(
                $"Legacy archive : {options.ZipPath}");
            Console.WriteLine(
                $"Mode           : {(options.Apply ? "APPLY" : "DRY RUN")}");
            Console.WriteLine();

            if (!await db.Database.CanConnectAsync())
            {
                Console.Error.WriteLine(
                    "Could not connect to Neon.");

                return 3;
            }

            var importer =
                new LegacyImporter(db);

            var result =
                await importer.ImportAsync(
                    options.ZipPath,
                    options.Apply);

            Console.WriteLine();
            Console.WriteLine("Import summary");
            Console.WriteLine("==============");
            Console.WriteLine(
                $"Items created/updated       : {result.Items}");
            Console.WriteLine(
                $"Sources created/updated     : {result.Sources}");
            Console.WriteLine(
                $"History changes imported    : {result.HistoryRows}");
            Console.WriteLine(
                $"Scrape run summaries        : {result.Runs}");
            Console.WriteLine(
                $"Latest scrape results       : {result.ScrapeResults}");
            Console.WriteLine(
                $"Subscriptions               : {result.Subscriptions}");
            Console.WriteLine();

            foreach (var warning in result.Warnings)
            {
                Console.WriteLine(
                    $"WARNING: {warning}");
            }

            Console.WriteLine();

            if (options.Apply)
            {
                Console.WriteLine(
                    "IMPORT COMPLETE. Changes were committed to Neon.");
            }
            else
            {
                Console.WriteLine(
                    "DRY RUN COMPLETE. All database changes were rolled back.");
                Console.WriteLine(
                    "Run again with --apply after checking the summary.");
            }

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine();
            Console.Error.WriteLine(
                "IMPORT FAILED");
            Console.Error.WriteLine(ex);

            return 1;
        }
    }

    private sealed class ProgramMarker
    {
    }
}

internal sealed record ImportOptions(
    string ZipPath,
    bool Apply)
{
    public static ImportOptions Parse(
        string[] args)
    {
        string? zipPath = null;
        var apply = false;

        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];

            if (arg.Equals(
                    "--zip",
                    StringComparison.OrdinalIgnoreCase))
            {
                if (i + 1 >= args.Length)
                {
                    throw new ArgumentException(
                        "--zip requires a file path.");
                }

                zipPath = args[++i];
            }
            else if (arg.Equals(
                         "--apply",
                         StringComparison.OrdinalIgnoreCase))
            {
                apply = true;
            }
            else if (arg.Equals(
                         "--dry-run",
                         StringComparison.OrdinalIgnoreCase))
            {
                apply = false;
            }
            else
            {
                throw new ArgumentException(
                    $"Unknown argument: {arg}");
            }
        }

        if (string.IsNullOrWhiteSpace(zipPath))
        {
            throw new ArgumentException(
                "Usage: dotnet run --project tools/PriceWatch.Migrator -- --zip \"path-to-data.zip\" [--dry-run|--apply]");
        }

        zipPath =
            Path.GetFullPath(zipPath);

        if (!File.Exists(zipPath))
        {
            throw new FileNotFoundException(
                "Legacy zip file was not found.",
                zipPath);
        }

        return new ImportOptions(
            zipPath,
            apply);
    }
}
