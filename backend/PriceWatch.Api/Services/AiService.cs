// ============================================================================
// File: Services/AiService.cs
// Purpose:
//   Calls the PriceWatch Python V10.3 AI gateway. The ASP.NET layer does not
//   calculate BUY/WAIT/NEUTRAL; it only maps trusted Product facts and user input
//   into the gateway's strict snake_case /recommend contract.
//
// Main functions:
//   - GetHealthAsync(): proxies /health.
//   - GetAdvisorsAsync(): proxies /advisors.
//   - RecommendAsync(): sends one product judgment to /recommend.
//
// Inputs:
//   AiRecommendationRequest from React and AiProductContext from the factual
//   PriceWatch context service.
//
// Outputs:
//   AiRecommendationResponse containing AI decision plus Python-rendered facts.
// ============================================================================

using System.Net.Http.Json;
using System.Text.Json;

using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;


public sealed class AiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };


    public AiService(
        HttpClient httpClient,
        ILogger<AiService> logger
    )
    {
        _httpClient = httpClient;
        _logger = logger;
    }


    public async Task<AiHealthDto> GetHealthAsync(
        CancellationToken cancellationToken
    )
    {
        using var response = await _httpClient.GetAsync(
            "health",
            cancellationToken
        );

        await EnsureSuccessAsync(response, cancellationToken);

        return await response.Content.ReadFromJsonAsync<AiHealthDto>(
            JsonOptions,
            cancellationToken
        ) ?? throw new HttpRequestException("AI health response was empty.");
    }


    public async Task<IReadOnlyList<AdvisorDto>> GetAdvisorsAsync(
        CancellationToken cancellationToken
    )
    {
        using var response = await _httpClient.GetAsync(
            "advisors",
            cancellationToken
        );

        await EnsureSuccessAsync(response, cancellationToken);

        var advisors =
            await response.Content.ReadFromJsonAsync<List<AdvisorDto>>(
                JsonOptions,
                cancellationToken
            );

        return advisors ?? [];
    }


    public async Task<AiRecommendationResponse> RecommendAsync(
        AiRecommendationRequest request,
        AiProductContext product,
        CancellationToken cancellationToken
    )
    {
        if (product.CurrentPrice is not double currentPrice || currentPrice <= 0)
        {
            throw new ArgumentException(
                "This product has no accepted current/history price for AI analysis."
            );
        }

        var payload = new
        {
            advisor_id = request.AdvisorId,
            language = NormalizeLanguage(request.Language),
            product = new
            {
                product_id = product.ProductId,
                name = product.Name,
                currency = product.Currency,
                current_price = currentPrice,
                price_status = product.PriceStatus,
                target_price = product.TargetPrice,
                historical_low = product.HistoricalLow,
                historical_average = product.HistoricalAverage,
                history = product.History.Select(point => new
                {
                    date = point.Date,
                    price = point.Price,
                }),
                current_unit_price = product.CurrentUnitPrice,
                target_unit_price = product.TargetUnitPrice,
                last_purchase_price = product.LastPurchasePrice,
                last_purchase_date = product.LastPurchaseDate?.ToString("yyyy-MM-dd"),
            },
            user_context = new
            {
                budget = request.UserContext.Budget,
                urgency = NormalizeLevel(request.UserContext.Urgency),
                replacement_need = NormalizeLevel(request.UserContext.ReplacementNeed),
                price_sensitivity = NormalizeLevel(request.UserContext.PriceSensitivity),
                owned_similar_products = request.UserContext.OwnedSimilarProducts
                    .Where(item => !string.IsNullOrWhiteSpace(item.Name))
                    .Select(item => new
                    {
                        name = item.Name.Trim(),
                        condition = NormalizeCondition(item.Condition),
                        similarity = NormalizeSimilarity(item.Similarity),
                    }),
                notes = request.UserContext.Notes
                    .Where(note => !string.IsNullOrWhiteSpace(note))
                    .Select(note => note.Trim()),
            },
        };

        _logger.LogInformation(
            "Requesting V10.3 AI recommendation for product {ProductId} using advisor {AdvisorId} and price status {PriceStatus}",
            product.ProductId,
            request.AdvisorId,
            product.PriceStatus
        );

        using var response = await _httpClient.PostAsJsonAsync(
            "recommend",
            payload,
            JsonOptions,
            cancellationToken
        );

        await EnsureSuccessAsync(response, cancellationToken);

        var result =
            await response.Content.ReadFromJsonAsync<AiRecommendationResponse>(
                JsonOptions,
                cancellationToken
            );

        return result
            ?? throw new HttpRequestException("AI recommendation response was empty.");
    }


    private static string NormalizeLevel(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "low" or "medium" or "high"
            ? normalized
            : "unknown";
    }


    private static string NormalizeLanguage(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized == "en" ? "en" : "zh";
    }


    private static string NormalizeCondition(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "good" or "excellent" or "working" or "broken" or "unusable"
                => normalized,
            _ => "unknown",
        };
    }


    private static string NormalizeSimilarity(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "high" or "very_high" => normalized,
            _ => "unknown",
        };
    }


    private async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        if (response.IsSuccessStatusCode)
            return;

        var error = await response.Content.ReadAsStringAsync(cancellationToken);

        _logger.LogError(
            "AI gateway returned {StatusCode}: {Error}",
            response.StatusCode,
            error
        );

        throw new HttpRequestException(
            $"AI gateway returned {(int)response.StatusCode}: {error}"
        );
    }
}
