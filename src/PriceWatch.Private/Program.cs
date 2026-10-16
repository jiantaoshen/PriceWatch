using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Private;
using PriceWatch.Private.Infrastructure;
using PriceWatch.Private.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.Configure<PrivateSettings>(
    builder.Configuration.GetSection("Private"));

var settings = builder.Configuration
    .GetSection("Private")
    .Get<PrivateSettings>()
    ?? new PrivateSettings();

var runOnce = args.Any(x => string.Equals(
    x,
    "--run-once",
    StringComparison.OrdinalIgnoreCase));

if (!runOnce && !IsLoopbackUrl(settings.ListenUrl))
{
    throw new InvalidOperationException(
        "Private API listen URL must use a loopback host.");
}

if (!runOnce &&
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

var connectionString =
    builder.Configuration.GetConnectionString("Database")
    ?? throw new InvalidOperationException(
        "Database connection string is missing.");

try
{
    _ = new NpgsqlConnectionStringBuilder(connectionString);
}
catch
{
    // Do not preserve the provider exception as an inner exception. Npgsql may
    // include the original connection string in its exception message.
    throw new InvalidOperationException(
        "Database connection string is invalid.");
}

builder.Services.AddDbContext<PriceWatchDbContext>(options =>
{
    options
        .UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention();
});

builder.Services.AddScoped<PriceUpdateService>();
builder.Services.AddScoped<PythonScraperClient>();
builder.Services.AddScoped<PriceValidationService>();
builder.Services.AddScoped<OfferSelectionService>();
builder.Services.AddScoped<ScrapeOrchestrator>();

builder.Services.AddSingleton<PostgreSqlScrapeLock>();
builder.Services.AddSingleton<ScrapeRunCoordinator>();
builder.Services.AddSingleton<PrivatePaths>();
builder.Services.AddSingleton<WindowsScheduleService>();

var app = builder.Build();

app.UseExceptionHandler();

if (runOnce)
{
    var logger = app.Services
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("PriceWatch.Private.RunOnce");

    try
    {
        var scrapeLock = app.Services
            .GetRequiredService<PostgreSqlScrapeLock>();

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
        var orchestrator = scope.ServiceProvider
            .GetRequiredService<ScrapeOrchestrator>();

        var runId = await orchestrator.RunOnceAsync();
        Console.WriteLine($"PriceWatch run completed: {runId}");
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
