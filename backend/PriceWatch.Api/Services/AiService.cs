// ============================================================================
// File: Services/AiService.cs
// Purpose:
//   Bridges the ASP.NET API to the existing PriceWatch AI service. This file is
//   intentionally kept compatible with the currently frozen V10.3 AI payload;
//   richer lifecycle/unit facts are prepared in AiProductContextService but are
//   not forwarded here until the external AI contract is deliberately updated.
//
// Main functions:
//   - GetAdvisorsAsync(token): fetches advisor metadata from the AI service.
//   - StreamChatAsync(request, stream, token): sends the current V10.3-compatible
//     product/chat payload and streams the AI response back to the frontend.
//   - EnsureSuccessAsync(...): converts non-success AI responses into exceptions.
//
// Inputs:
//   AiChatPayload containing advisor ID, selected products, and chat messages.
//
// Outputs:
//   AdvisorDto list or streamed text from the AI backend.
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

        // Keep the external AI request shape frozen for now. The new fields in
        // AiProductContext can be wired in later together with the AI server/prompt.
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
