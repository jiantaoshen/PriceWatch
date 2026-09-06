using Microsoft.AspNetCore.Mvc;

using PriceWatch.Api.Models;
using PriceWatch.Api.Services;

namespace PriceWatch.Api.Controllers;

[ApiController]
[Route("api/chat")]
public sealed class ChatController : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly AiProductContextService _contextService;

    public ChatController(
        IAiService aiService,
        AiProductContextService contextService
    )
    {
        _aiService = aiService;
        _contextService = contextService;
    }

    [HttpPost("stream")]
    public async Task Stream(
        [FromBody] AiChatRequest request,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(request.AdvisorId))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;

            await Response.WriteAsJsonAsync(
                new { error = "Advisor ID is required." },
                cancellationToken
            );

            return;
        }

        try
        {
            var products = await _contextService.BuildAsync(
                request.ProductIds,
                cancellationToken
            );

            var payload = new AiChatPayload
            {
                AdvisorId = request.AdvisorId,
                Products = products,
                Messages = request.Messages,
            };

            Response.StatusCode = StatusCodes.Status200OK;
            Response.ContentType = "text/plain; charset=utf-8";

            await _aiService.StreamChatAsync(
                payload,
                Response.Body,
                cancellationToken
            );
        }
        catch (OperationCanceledException)
            when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (ArgumentException exception)
        {
            if (Response.HasStarted)
                throw;

            Response.StatusCode = StatusCodes.Status400BadRequest;

            await Response.WriteAsJsonAsync(
                new { error = exception.Message },
                cancellationToken
            );
        }
        catch (HttpRequestException exception)
        {
            if (Response.HasStarted)
                throw;

            Response.StatusCode = StatusCodes.Status502BadGateway;

            await Response.WriteAsJsonAsync(
                new
                {
                    error = "Local AI service unavailable.",
                    detail = exception.Message,
                },
                cancellationToken
            );
        }
    }
}