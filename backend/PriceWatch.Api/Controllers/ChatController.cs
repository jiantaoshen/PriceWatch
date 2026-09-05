using PriceWatch.Api.Models;
using PriceWatch.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace PriceWatch.Api.Controllers;

[ApiController]
[Route("api/chat")]
public class ChatController : ControllerBase
{
    private readonly IAiService _aiService;

    public ChatController(
        IAiService aiService
    )
    {
        _aiService = aiService;
    }

    [HttpGet("test")]
    public IActionResult Test()
    {
        return Ok(
            "ASP.NET works"
        );
    }

    [HttpPost("stream")]
    public async Task Stream(
        [FromBody] ChatRequest request,
        CancellationToken cancellationToken
    )
    {
        Response.StatusCode =
            StatusCodes.Status200OK;

        Response.ContentType =
            "text/plain; charset=utf-8";

        await _aiService.StreamChatAsync(
            request,
            Response.Body,
            cancellationToken
        );
    }
}