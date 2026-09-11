// ============================================================================
// File: Controllers/ChatController.cs
// Purpose:
//   Replaces the old streaming-chat controller with the structured V10.3 Advisor
//   bridge used by React. The legacy filename is retained for a drop-in upgrade.
//
// Main endpoints:
//   - GET  /api/ai/health: verifies which AI provider/model ASP.NET can reach.
//   - POST /api/ai/recommend: builds trusted Product facts and requests one
//     BUY/WAIT/NEUTRAL recommendation.
//
// Inputs:
//   Product ID, advisor ID and optional user context from React.
//
// Outputs:
//   V10.3 structured recommendation or a clear 4xx/502 error. This controller
//   never changes the AI's final decision.
// ============================================================================

using Microsoft.AspNetCore.Mvc;

using PriceWatch.Api.Models;
using PriceWatch.Api.Services;

namespace PriceWatch.Api.Controllers;


[ApiController]
[Route("api/ai")]
public sealed class AiController : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly AiProductContextService _contextService;


    public AiController(
        IAiService aiService,
        AiProductContextService contextService
    )
    {
        _aiService = aiService;
        _contextService = contextService;
    }


    [HttpGet("health")]
    public async Task<IActionResult> Health(
        CancellationToken cancellationToken
    )
    {
        try
        {
            var health = await _aiService.GetHealthAsync(cancellationToken);
            return Ok(health);
        }
        catch (HttpRequestException exception)
        {
            return Problem(
                title: "AI service unavailable",
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway
            );
        }
    }


    [HttpPost("recommend")]
    public async Task<IActionResult> Recommend(
        [FromBody] AiRecommendationRequest request,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(request.AdvisorId))
        {
            return BadRequest(new { error = "Advisor ID is required." });
        }

        if (string.IsNullOrWhiteSpace(request.ProductId))
        {
            return BadRequest(new { error = "Product ID is required." });
        }

        try
        {
            var products = await _contextService.BuildAsync(
                [request.ProductId],
                cancellationToken
            );

            var product = products.SingleOrDefault();
            if (product is null)
            {
                return NotFound(new { error = "Product not found." });
            }

            if (product.CurrentPrice is null)
            {
                return UnprocessableEntity(new
                {
                    error = "No accepted price is available for AI analysis.",
                });
            }

            var result = await _aiService.RecommendAsync(
                request,
                product,
                cancellationToken
            );

            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
        catch (HttpRequestException exception)
        {
            return Problem(
                title: "AI service unavailable",
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway
            );
        }
    }
}
