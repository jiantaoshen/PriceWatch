using Microsoft.AspNetCore.Mvc;

using PriceWatch.Api.Services;

namespace PriceWatch.Api.Controllers;

[ApiController]
[Route("api/advisors")]
public sealed class AdvisorsController : ControllerBase
{
    private readonly IAiService _aiService;

    public AdvisorsController(IAiService aiService)
    {
        _aiService = aiService;
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        CancellationToken cancellationToken
    )
    {
        try
        {
            var advisors =
                await _aiService.GetAdvisorsAsync(cancellationToken);

            return Ok(advisors);
        }
        catch (HttpRequestException exception)
        {
            return Problem(
                title: "Local AI service unavailable",
                detail: exception.Message,
                statusCode: StatusCodes.Status502BadGateway
            );
        }
    }
}