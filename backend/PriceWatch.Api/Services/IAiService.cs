using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;

public interface IAiService
{
    Task<IReadOnlyList<AdvisorDto>> GetAdvisorsAsync(
        CancellationToken cancellationToken
    );

    Task StreamChatAsync(
        AiChatPayload request,
        Stream outputStream,
        CancellationToken cancellationToken
    );
}

