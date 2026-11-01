using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Private;
using PriceWatch.Private.Infrastructure;
using PriceWatch.Private.Models;
using PriceWatch.Private.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddDataProtection()
    .SetApplicationName("PriceWatch.Private");

builder.Services.Configure<PrivateSettings>(
    builder.Configuration.GetSection("Private"));
builder.Services.Configure<EmailAlertSettings>(
    builder.Configuration.GetSection("Email"));

var settings = builder.Configuration
    .GetSection("Private")
    .Get<PrivateSettings>()
    ?? new PrivateSettings();

var runOnce = args.Any(x => string.Equals(
    x,
    "--run-once",
    StringComparison.OrdinalIgnoreCase));
var checkSqlite = args.Any(x => string.Equals(
    x, "--check-sqlite", StringComparison.OrdinalIgnoreCase));

if (!runOnce && !checkSqlite && !IsLoopbackUrl(settings.ListenUrl))
{
    throw new InvalidOperationException(
        "Private API listen URL must use a loopback host.");
}

if (!runOnce && !checkSqlite &&
    (string.IsNullOrWhiteSpace(settings.ApiToken) || settings.ApiToken.Length < 32))
{
    throw new InvalidOperationException(
        "Private API token is missing or too short. Configure at least 32 characters.");
}

builder.WebHost.UseUrls(settings.ListenUrl);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

// The independent scheduled worker uses an existing verified local SQLite
// snapshot. ReadWrite (not ReadWriteCreate) prevents silent empty DB creation.
var sqlitePath = builder.Configuration["PriceWatch:SqlitePath"]
    ?? throw new InvalidOperationException(
        "PriceWatch:SqlitePath is missing. Set PRICEWATCH_SQLITE_PATH in .env.local.");
sqlitePath = Path.GetFullPath(sqlitePath);
if (!File.Exists(sqlitePath))
    throw new FileNotFoundException("Verified local SQLite file does not exist.", sqlitePath);

var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = sqlitePath,
    Mode = SqliteOpenMode.ReadWrite,
    ForeignKeys = true,
    DefaultTimeout = 5,
    Pooling = false
}.ToString();

// Fail before starting the browser or modifying data if the staging schema
// is absent or damaged. This is NOT a schema migration.
using (var probe = new SqliteConnection(connectionString))
{
    probe.Open();
    using var check = probe.CreateCommand();
    check.CommandText = "PRAGMA integrity_check";
    if (!string.Equals(check.ExecuteScalar()?.ToString(), "ok", StringComparison.Ordinal))
        throw new InvalidOperationException("SQLite integrity_check failed.");
    check.CommandText = "PRAGMA foreign_key_check";
    using (var reader = check.ExecuteReader())
    {
        if (reader.Read())
            throw new InvalidOperationException("SQLite foreign_key_check failed.");
    }
    check.CommandText = "SELECT COUNT(*) FROM migration_audit";
    if (Convert.ToInt32(check.ExecuteScalar()) != 8)
        throw new InvalidOperationException("Expected verified 8-table staging SQLite schema.");
}

builder.Services.AddDbContext<PriceWatchDbContext>(options =>
{
    options
        .UseSqlite(connectionString)
        .UseSnakeCaseNamingConvention();
});

builder.Services.AddScoped<PriceTrackingService>();
builder.Services.AddScoped<PythonScraperClient>();
builder.Services.AddScoped<PriceValidationService>();
builder.Services.AddScoped<ScrapeOrchestrator>();
builder.Services.AddScoped<ScrapeRunRecoveryService>();
builder.Services.AddScoped<PriceAlertEmailSender>();

builder.Services.AddSingleton<SqliteScrapeLock>();
builder.Services.AddSingleton<ScrapeRunCoordinator>();
builder.Services.AddSingleton<PrivatePaths>();
builder.Services.AddSingleton<EmailAlertSettingsStore>();
builder.Services.AddSingleton<WindowsScheduleService>();

var app = builder.Build();

app.UseExceptionHandler();

if (checkSqlite)
{
    // Read-only provider/materialization check; no Playwright, no network,
    // no SaveChanges, no task registration.
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PriceWatchDbContext>();
    var items = await db.TrackedItems.AsNoTracking().CountAsync();
    _ = await db.TrackedItems.AsNoTracking().OrderBy(x => x.Name).FirstOrDefaultAsync();
    var prices = await db.PriceObservations.AsNoTracking().CountAsync();
    _ = await db.PriceObservations.AsNoTracking()
        .OrderByDescending(x => x.ObservedAt).FirstOrDefaultAsync();
    var runs = await db.ScrapeRuns.AsNoTracking().CountAsync();
    Console.WriteLine($"SQLite read check OK. Items={items}, prices={prices}, runs={runs}");
    return;
}

if (runOnce)
{
    var logger = app.Services
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("PriceWatch.Private.RunOnce");

    try
    {
        var scrapeLock = app.Services
            .GetRequiredService<SqliteScrapeLock>();

        await using var globalLock =
            await scrapeLock.TryAcquireAsync();

        if (globalLock is null)
        {
            logger.LogInformation(
                "Scheduled scrape skipped because another run already holds the global lock.");

            Console.WriteLine(
                "PriceWatch run skipped: another scrape run is already active.");

            return;
        }

        using var scope = app.Services.CreateScope();
        var recovery = scope.ServiceProvider
            .GetRequiredService<ScrapeRunRecoveryService>();
        var orchestrator = scope.ServiceProvider
            .GetRequiredService<ScrapeOrchestrator>();

        await recovery.RecoverAbandonedRunsAsync(
            DateTimeOffset.UtcNow);

        var runId = await orchestrator.RunOnceAsync(
            ScrapeTrigger.Scheduled);

        if (runId.HasValue)
        {
            Console.WriteLine(
                $"PriceWatch scheduled run completed: {runId.Value}");
        }
        else
        {
            Console.WriteLine(
                "PriceWatch scheduled run skipped: no scraping-enabled items are due.");
        }
    }
    catch (Exception exception)
    {
        var errorId = Guid.NewGuid();

        logger.LogError(
            "Scheduled scrape run failed. ErrorId={ErrorId}, Type={ExceptionType}, StackTrace={StackTrace}",
            errorId,
            exception.GetType().FullName,
            exception.StackTrace);

        Console.Error.WriteLine(
            $"PriceWatch run failed. Error ID: {errorId}");

        Environment.ExitCode = 1;
    }

    return;
}

app.UseMiddleware<PrivateApiTokenMiddleware>();
app.MapPrivateApi();

Console.WriteLine($"PriceWatch.Private listening on {settings.ListenUrl}");
Console.WriteLine("This API is restricted to loopback and requires local proxy authentication.");

await app.RunAsync();

static bool IsLoopbackUrl(string value)
{
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
    {
        return false;
    }

    if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return IPAddress.TryParse(uri.Host, out var address) &&
        IPAddress.IsLoopback(address);
}
