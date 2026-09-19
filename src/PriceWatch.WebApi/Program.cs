using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using PriceWatch.Core.Services;
using PriceWatch.Data;

var builder = WebApplication.CreateBuilder(args);


// ============================================================
// Controllers
// ============================================================

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter());
    });

// ============================================================
// Database
// ============================================================

builder.Services.AddDbContextPool<PriceWatchDbContext>(options =>
{
    var connectionString =
        builder.Configuration.GetConnectionString("Database")
        ?? throw new InvalidOperationException(
            "Database connection string is missing.");

    options
        .UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention();
});


// ============================================================
// Core services
// ============================================================

builder.Services.AddScoped<PriceUpdateService>();


// ============================================================
// Microsoft Authentication
// ============================================================

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(
        builder.Configuration.GetSection("AzureAd"));


// ============================================================
// Owner-only Authorization
// ============================================================

var ownerOid =
    builder.Configuration["Owner:Oid"];

var ownerSub =
    builder.Configuration["Owner:Sub"];


if (string.IsNullOrWhiteSpace(ownerOid) &&
    string.IsNullOrWhiteSpace(ownerSub))
{
    throw new InvalidOperationException(
        "Owner identity is not configured. " +
        "Set Owner:Oid or Owner:Sub using user-secrets.");
}


builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("OwnerOnly", policy =>
    {
        // User must first have a valid Microsoft access token.
        policy.RequireAuthenticatedUser();

        policy.RequireAssertion(context =>
        {
            var user = context.User;


            // Preferred identifier.
            var oid =
                user.FindFirstValue("oid");


            // Depending on claim mapping,
            // "sub" may appear as NameIdentifier.
            var sub =
                user.FindFirstValue("sub")
                ?? user.FindFirstValue(
                    ClaimTypes.NameIdentifier);


            var oidMatches =
                !string.IsNullOrWhiteSpace(ownerOid) &&
                string.Equals(
                    oid,
                    ownerOid,
                    StringComparison.OrdinalIgnoreCase);


            var subMatches =
                !string.IsNullOrWhiteSpace(ownerSub) &&
                string.Equals(
                    sub,
                    ownerSub,
                    StringComparison.Ordinal);


            return oidMatches || subMatches;
        });
    });
});


// ============================================================
// CORS
// ============================================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins(
                builder.Configuration["Frontend:Origin"] ?? "http://localhost:3000",
                "https://pricewatch.jiantao.dev"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});


var app = builder.Build();


// ============================================================
// HTTP pipeline
// ============================================================

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();


// ============================================================
// Development-only database health check
// ============================================================

if (app.Environment.IsDevelopment())
{
    app.MapGet(
        "/api/health/database",
        async (PriceWatchDbContext db) =>
        {
            return Results.Ok(new
            {
                connected =
                    await db.Database.CanConnectAsync()
            });
        });
}


app.Run();