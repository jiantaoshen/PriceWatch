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

// Load user-secrets even for --run-once executions started by Task Scheduler.
builder.Configuration.AddUserSecrets<Program>(optional: true);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.Configure<PrivateSettings>(
    builder.Configuration.GetSection("Private"));

var settings = builder.Configuration
    .GetSection("Private")
    .Get<PrivateSettings>()
    ?? new PrivateSettings();

builder.WebHost.UseUrls(settings.ListenUrl);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("PrivateFrontend", policy =>
    {
        policy
            .WithOrigins(settings.FrontendOrigin)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
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

builder.Services.AddSingleton<ScrapeRunCoordinator>();
builder.Services.AddSingleton<PrivatePaths>();
builder.Services.AddSingleton<WindowsScheduleService>();

var app = builder.Build();

app.UseExceptionHandler();

if (args.Any(x => string.Equals(
        x,
        "--run-once",
        StringComparison.OrdinalIgnoreCase)))
{
    using var scope = app.Services.CreateScope();
    var orchestrator = scope.ServiceProvider
        .GetRequiredService<ScrapeOrchestrator>();

    try
    {
        var runId = await orchestrator.RunOnceAsync();
        Console.WriteLine($"PriceWatch run completed: {runId}");
    }
    catch (Exception exception)
    {
        var errorId = Guid.NewGuid();
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("PriceWatch.Private.RunOnce");

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

app.UseCors("PrivateFrontend");
app.MapPrivateApi();

Console.WriteLine($"PriceWatch.Private listening on {settings.ListenUrl}");
Console.WriteLine("This API is intended for localhost/private use only.");

await app.RunAsync();
