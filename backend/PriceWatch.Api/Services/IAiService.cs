// ============================================================================
// File: Services/IAiService.cs
// Purpose:
//   Defines the ASP.NET-to-Python V10.3 AI gateway contract.
// Main functions:
//   - GetHealthAsync(): check the configured AI gateway/provider.
//   - GetAdvisorsAsync(): load advisor metadata.
//   - RecommendAsync(): request one structured purchase judgment.
// Inputs:
//   Prepared accepted Product context plus user context from React.
// Outputs:
//   Structured V10.3 recommendation response; no streaming natural-language chat.
// ============================================================================

using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;


public interface IAiService
{
    Task<AiHealthDto> GetHealthAsync(
        CancellationToken cancellationToken
    );

    Task<IReadOnlyList<AdvisorDto>> GetAdvisorsAsync(
        CancellationToken cancellationToken
    );

    Task<AiRecommendationResponse> RecommendAsync(
        AiRecommendationRequest request,
        AiProductContext product,
        CancellationToken cancellationToken
    );
}
