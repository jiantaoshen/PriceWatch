using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PriceWatch.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    [Authorize(Policy = "OwnerOnly")]
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new
        {
            oid = User.FindFirstValue("oid"),

            sub =
                User.FindFirstValue("sub")
                ?? User.FindFirstValue(
                    ClaimTypes.NameIdentifier),

            tid = User.FindFirstValue("tid"),

            name = User.Identity?.Name
        });
    }
}