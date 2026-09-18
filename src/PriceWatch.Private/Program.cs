using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using PriceWatch.Core.Services;
using PriceWatch.Data;
using PriceWatch.Private;
using PriceWatch.Private.Services;

var builder = WebApplication.CreateBuilder(args);

// Load user-secrets even for --run-once executions started by Task Scheduler.
builder.Configuration.AddUserSecrets<Program>(optional: true);

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

builder.Services.AddDbContext<PriceWatchDbContext>(options =>
{
    var connectionString = builder.Configuration
        .GetConnectionString("Database")
        ?? throw new InvalidOperationException(
            "ConnectionStrings:Database is missing. Set it with dotnet user-secrets for PriceWatch.Private.");

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

if (args.Any(x => string.Equals(
        x,
        "--run-once",
        StringComparison.OrdinalIgnoreCase)))
{
    using var scope = app.Services.CreateScope();
    var orchestrator = scope.ServiceProvider
        .GetRequiredService<ScrapeOrchestrator>();

    var runId = await orchestrator.RunOnceAsync();
    Console.WriteLine($"PriceWatch run completed: {runId}");
    return;
}

app.UseCors("PrivateFrontend");
app.MapPrivateApi();

Console.WriteLine($"PriceWatch.Private listening on {settings.ListenUrl}");
Console.WriteLine("This API is intended for localhost/private use only.");

await app.RunAsync();
