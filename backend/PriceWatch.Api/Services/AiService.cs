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

    public AiService(HttpClient httpClient, ILogger<AiService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<IReadOnlyList<CharacterDto>> GetCharactersAsync(
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation("Requesting characters from AI service");

        using var response = await _httpClient.GetAsync(
            "characters",
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken
        );

        await EnsureSuccessAsync(response, cancellationToken);

        var characters = await response.Content.ReadFromJsonAsync<List<CharacterDto>>(
            JsonOptions,
            cancellationToken
        );

        return characters ?? [];
    }

    public async Task StreamChatAsync(
        ChatRequest request,
        Stream outputStream,
        CancellationToken cancellationToken
    )
    {
        _logger.LogInformation(
            "Sending chat request for character {CharacterId} with {MessageCount} messages",
            request.CharacterId,
            request.Messages.Count
        );

        var payload = new
        {
            character_id = request.CharacterId,
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

        await using var aiStream = await response.Content.ReadAsStreamAsync(
            cancellationToken
        );

        var buffer = new byte[4096];

        while (true)
        {
            var bytesRead = await aiStream.ReadAsync(
                buffer.AsMemory(),
                cancellationToken
            );

            if (bytesRead == 0) break;

            await outputStream.WriteAsync(
                buffer.AsMemory(0, bytesRead),
                cancellationToken
            );

            await outputStream.FlushAsync(cancellationToken);
        }

        _logger.LogInformation(
            "AI stream completed for character {CharacterId}",
            request.CharacterId
        );
    }

    private async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken
    )
    {
        if (response.IsSuccessStatusCode) return;

        var error = await response.Content.ReadAsStringAsync(cancellationToken);

        _logger.LogError(
            "AI service returned {StatusCode}: {Error}",
            response.StatusCode,
            error
        );

        throw new HttpRequestException(
            $"AI service returned {(int)response.StatusCode}: {error}"
        );
    }
}
