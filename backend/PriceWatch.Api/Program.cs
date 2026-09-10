// ============================================================================
// File: Program.cs
// Purpose:
//   Configures the PriceWatch ASP.NET API and maps all HTTP endpoints, including
//   product lifecycle and price-review actions. Suspicious-price confirmation is
//   handled here without changing the existing external AI chat contract.
//
// Main product functions/endpoints:
//   - GET    /api/product-config            -> list saved product configs.
//   - GET    /api/product-config/{id}       -> fetch one config for editing.
//   - POST   /api/product-config            -> create a tracked product.
//   - PUT    /api/product-config/{id}       -> update scraper settings only.
//   - POST   /{id}/mark-owned               -> save purchase lifecycle data.
//   - POST   /{id}/mark-subscription        -> save subscription lifecycle data.
//   - POST   /{id}/mark-tracked             -> clear lifecycle data, keep tracking.
//   - POST   /{id}/price-review/accept       -> accept a suspicious scraped price.
//   - POST   /{id}/price-review/manual       -> save a trusted manual source price.
//   - DELETE /api/product-config/{id}       -> delete product configuration.
//
// Inputs:
//   HTTP requests from the React frontend and existing scraper/AI operations.
//
// Outputs:
//   JSON/file/stream HTTP responses. Enums are serialized as camel-case strings
//   such as "tracked", "owned", "subscription", and "monthly".
// ============================================================================

using System.Text.Json;
using System.Text.Json.Serialization;

using PriceWatch.Api.DTOs;
using PriceWatch.Api.Models;
using PriceWatch.Api.Services;

var builder = WebApplication.CreateBuilder(args);


// ============================================================
// Services
// ============================================================

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
        );
    });

// Minimal API responses use a separate JSON options object.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)
    );
});

builder.Services.AddSingleton<AppPaths>();
builder.Services.AddSingleton<ScraperRunner>();
builder.Services.AddSingleton<ScheduleService>();
builder.Services.AddSingleton<ProductConfigService>();
builder.Services.AddSingleton<PriceReviewService>();
builder.Services.AddSingleton<EmailSettingsService>();
builder.Services.AddSingleton<AiProductContextService>();


// ============================================================
// Local AI
// ============================================================

builder.Services.AddHttpClient<IAiService, AiService>(client =>
{
    var baseUrl =
        builder.Configuration["Ai:BaseUrl"]
        ?? "http://127.0.0.1:8000/";

    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = Timeout.InfiniteTimeSpan;
});


// ============================================================
// Development CORS
//
// Production uses the same ASP.NET Core origin for React and
// /api, so CORS is only needed while using Vite.
// ============================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


var app = builder.Build();


// ============================================================
// React static files
// ============================================================

app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseCors("Frontend");
}


// ============================================================
// Health
// ============================================================

app.MapGet("/api/health", () =>
{
    return Results.Ok(new
    {
        status = "ok",
        service = "PriceWatch.Api",
        timestamp = DateTimeOffset.UtcNow,
    });
});


// ============================================================
// Latest product price data
// ============================================================

app.MapGet("/api/latest", (AppPaths paths) =>
{
    if (!File.Exists(paths.LatestFile))
    {
        return Results.Ok(new
        {
            period = "",
            generated_at = "",
            data = Array.Empty<object>(),
        });
    }

    return Results.File(
        paths.LatestFile,
        contentType: "application/json"
    );
});


// ============================================================
// History index
// ============================================================

app.MapGet("/api/history", (AppPaths paths) =>
{
    var indexFile =
        Path.Combine(paths.HistoryDirectory, "index.json");

    if (!File.Exists(indexFile))
    {
        return Results.Ok(new
        {
            periods = Array.Empty<string>(),
        });
    }

    return Results.File(
        indexFile,
        contentType: "application/json"
    );
});


// ============================================================
// History period
// ============================================================

app.MapGet("/api/history/{period}", (string period, AppPaths paths) =>
{
    if (
        string.IsNullOrWhiteSpace(period) ||
        Path.GetFileName(period) != period ||
        period.Contains('/') ||
        period.Contains('\\')
    )
    {
        return Results.BadRequest(new
        {
            error = "Invalid history period",
        });
    }

    var historyFile =
        Path.Combine(paths.HistoryDirectory, $"{period}.json");

    if (!File.Exists(historyFile))
    {
        return Results.NotFound(new
        {
            error = "History period not found",
            period,
        });
    }

    return Results.File(
        historyFile,
        contentType: "application/json"
    );
});


// ============================================================
// Latest scraper run
// ============================================================

app.MapGet("/api/runs/latest", (AppPaths paths) =>
{
    var latestRunFile =
        Path.Combine(paths.RunsDirectory, "latest.json");

    if (!File.Exists(latestRunFile))
    {
        return Results.NotFound();
    }

    return Results.File(
        latestRunFile,
        contentType: "application/json"
    );
});


// ============================================================
// Scraper status
// ============================================================

app.MapGet("/api/scraper/status", (ScraperRunner runner) =>
{
    return Results.Ok(new
    {
        running = runner.IsRunning,
        process_id = runner.ProcessId,
    });
});


// ============================================================
// Run scraper now
// ============================================================

app.MapPost("/api/scraper/run", (ScraperRunner runner) =>
{
    var started = runner.TryStart(out var error);

    if (!started)
    {
        if (runner.IsRunning)
        {
            return Results.Conflict(new
            {
                error,
            });
        }

        return Results.Problem(detail: error);
    }

    return Results.Accepted(
        "/api/scraper/status",
        new
        {
            status = "started",
            message = "Price checker started.",
        }
    );
});


// ============================================================
// Schedule status
// ============================================================

app.MapGet("/api/schedule", async (ScheduleService service) =>
{
    var schedule = await service.GetAsync();
    return Results.Ok(schedule);
});


// ============================================================
// Create / update schedule
// ============================================================

app.MapPut(
    "/api/schedule",
    async (ScheduleRequest request, ScheduleService service) =>
    {
        try
        {
            var schedule = await service.ApplyAsync(request);
            return Results.Ok(schedule);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                error = exception.Message,
            });
        }
        catch (Exception exception)
        {
            return Results.Problem(detail: exception.Message);
        }
    }
);


// ============================================================
// Delete schedule
// ============================================================

app.MapDelete("/api/schedule", async (ScheduleService service) =>
{
    try
    {
        await service.DeleteAsync();
        return Results.NoContent();
    }
    catch (Exception exception)
    {
        return Results.Problem(detail: exception.Message);
    }
});


// ============================================================
// Product configuration + lifecycle
// ============================================================

app.MapGet("/api/product-config", async (ProductConfigService service) =>
{
    var products = await service.GetAllAsync();
    return Results.Ok(products);
});


app.MapGet(
    "/api/product-config/{id}",
    async (string id, ProductConfigService service) =>
    {
        try
        {
            var product = await service.GetByIdAsync(id);
            return Results.Ok(product);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapPost(
    "/api/product-config",
    async (ProductConfigInput input, ProductConfigService service) =>
    {
        try
        {
            var created = await service.CreateAsync(input);

            return Results.Created(
                $"/api/product-config/{created.Id}",
                created
            );
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapPut(
    "/api/product-config/{id}",
    async (
        string id,
        ProductConfigInput input,
        ProductConfigService service
    ) =>
    {
        try
        {
            var updated = await service.UpdateAsync(id, input);
            return Results.Ok(updated);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapPost(
    "/api/product-config/{id}/mark-owned",
    async (
        string id,
        MarkProductOwnedInput input,
        ProductConfigService service
    ) =>
    {
        try
        {
            var updated = await service.MarkOwnedAsync(id, input);
            return Results.Ok(updated);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapPost(
    "/api/product-config/{id}/mark-subscription",
    async (
        string id,
        MarkSubscriptionInput input,
        ProductConfigService service
    ) =>
    {
        try
        {
            var updated = await service.MarkSubscriptionAsync(id, input);
            return Results.Ok(updated);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapPost(
    "/api/product-config/{id}/mark-tracked",
    async (string id, ProductConfigService service) =>
    {
        try
        {
            var updated = await service.MarkTrackedAsync(id);
            return Results.Ok(updated);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


// ============================================================
// Price review
// ============================================================

app.MapPost(
    "/api/product-config/{id}/price-review/accept",
    async (
        string id,
        PriceReviewService reviewService,
        ScraperRunner runner
    ) =>
    {
        if (runner.IsRunning)
        {
            return Results.Conflict(new
            {
                error = "Wait for the current price check to finish before confirming a price.",
            });
        }

        try
        {
            var confirmed = await reviewService.AcceptSuspiciousPriceAsync(id);
            return Results.Ok(confirmed);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
        catch (InvalidOperationException exception)
        {
            return Results.Conflict(new { error = exception.Message });
        }
    }
);


app.MapPost(
    "/api/product-config/{id}/price-review/manual",
    async (
        string id,
        SetManualSourcePriceInput input,
        ProductConfigService service,
        ScraperRunner runner
    ) =>
    {
        if (runner.IsRunning)
        {
            return Results.Conflict(new
            {
                error = "Wait for the current price check to finish before changing a source to manual price mode.",
            });
        }

        try
        {
            var updated = await service.SetManualSourcePriceAsync(id, input);
            return Results.Ok(updated);
        }
        catch (KeyNotFoundException exception)
        {
            return Results.NotFound(new { error = exception.Message });
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new { error = exception.Message });
        }
    }
);


app.MapDelete(
    "/api/product-config/{id}",
    async (string id, ProductConfigService service) =>
    {
        try
        {
            await service.DeleteAsync(id);
            return Results.NoContent();
        }
        catch (KeyNotFoundException)
        {
            return Results.NotFound(new { error = "Product not found" });
        }
    }
);


// ============================================================
// Email settings
// ============================================================

app.MapGet("/api/settings/email", async (EmailSettingsService service) =>
{
    var settings = await service.GetAsync();
    return Results.Ok(settings);
});


app.MapPut(
    "/api/settings/email",
    async (
        UpdateEmailSettingsRequest request,
        EmailSettingsService service
    ) =>
    {
        try
        {
            var settings = await service.SaveAsync(request);
            return Results.Ok(settings);
        }
        catch (ArgumentException exception)
        {
            return Results.BadRequest(new
            {
                error = exception.Message,
            });
        }
    }
);


// ============================================================
// Test email
// ============================================================

app.MapPost(
    "/api/settings/email/test",
    async (EmailSettingsService service) =>
    {
        var result = await service.TestAsync();

        if (!result.Success)
        {
            return Results.BadRequest(result);
        }

        return Results.Ok(result);
    }
);


// ============================================================
// AI controllers
//
// /api/characters
// /api/chat/stream
// etc.
// ============================================================

app.MapControllers();


// ============================================================
// React SPA fallback
//
// Must stay after all /api endpoints and controllers.
// ============================================================

app.MapFallbackToFile("index.html");


app.Run();

