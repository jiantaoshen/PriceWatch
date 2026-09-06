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
    };

    public AiService(
        HttpClient httpClient,
        ILogger<AiService> logger
    )
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<IReadOnlyList<AdvisorDto>> GetAdvisorsAsync(
        CancellationToken cancellationToken
    )
    {
        using var response = await _httpClient.GetAsync(
            "advisors",
            HttpCompletionOption.ResponseHeadersRead,
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

    public async Task StreamChatAsync(
        AiChatPayload request,
        Stream outputStream,
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Sending AI request using advisor {AdvisorId} with {ProductCount} products and {MessageCount} messages",
            request.AdvisorId,
            request.Products.Count,
            request.Messages.Count
        );

        var payload = new
        {
            advisor_id = request.AdvisorId,

            products = request.Products.Select(product => new
            {
                product_id = product.ProductId,
                name = product.Name,
                currency = product.Currency,

                current_price = product.CurrentPrice,
                target_price = product.TargetPrice,
                previous_price = product.PreviousPrice,

                historical_low = product.HistoricalLow,
                historical_high = product.HistoricalHigh,
                historical_average = product.HistoricalAverage,

                history = product.History.Select(point => new
                {
                    date = point.Date,
                    price = point.Price,
                }),
            }),

            messages = request.Messages.Select(message => new
            {
                role = message.Role,
                content = message.Content,
            }),
        };

        using var httpRequest = new HttpRequestMessage(
            HttpMethod.Post,
            "chat/stream"
        )
        {
            Content = JsonContent.Create(payload),
        };

        using var response = await _httpClient.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );

        await EnsureSuccessAsync(response, cancellationToken);

        await using var aiStream =
            await response.Content.ReadAsStreamAsync(cancellationToken);

        var buffer = new byte[4096];

        while (true)
        {
            var bytesRead = await aiStream.ReadAsync(
                buffer.AsMemory(),
                cancellationToken
            );

            if (bytesRead == 0)
                break;

            await outputStream.WriteAsync(
                buffer.AsMemory(0, bytesRead),
                cancellationToken
            );

            await outputStream.FlushAsync(cancellationToken);
        }
    }

    private async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        if (response.IsSuccessStatusCode)
            return;

        var error =
            await response.Content.ReadAsStringAsync(cancellationToken);

        _logger.LogError(
            "Local AI returned {StatusCode}: {Error}",
            response.StatusCode,
            error
        );

        throw new HttpRequestException(
            $"Local AI returned {(int)response.StatusCode}: {error}"
        );
    }
}