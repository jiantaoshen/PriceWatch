using PriceWatch.Api.Models; 

namespace PriceWatch.Api.Services;

public interface IAiService
{
    Task<IReadOnlyList<CharacterDto>> GetCharactersAsync(
        CancellationToken cancellationToken
    );

    Task StreamChatAsync(
        ChatRequest request,
        Stream outputStream,
        CancellationToken cancellationToken
    );
}