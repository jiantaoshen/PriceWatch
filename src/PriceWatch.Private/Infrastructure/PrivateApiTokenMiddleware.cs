using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace PriceWatch.Private.Infrastructure;

public sealed class PrivateApiTokenMiddleware
{
    public const string HeaderName = "X-PriceWatch-Token";

    private readonly RequestDelegate _next;
    private readonly byte[] _expectedToken;

    public PrivateApiTokenMiddleware(
        RequestDelegate next,
        IOptions<PrivateSettings> options)
    {
        _next = next;
        _expectedToken = Encoding.UTF8.GetBytes(options.Value.ApiToken);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api/private"))
        {
            await _next(context);
            return;
        }

        var suppliedValues = context.Request.Headers[HeaderName];
        var suppliedToken = suppliedValues.Count == 1
            ? suppliedValues[0]
            : null;

        if (!IsValidToken(suppliedToken))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.Headers["Cache-Control"] = "no-store";

            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Private API authentication is required."
            });

            return;
        }

        await _next(context);
    }

    private bool IsValidToken(string? suppliedToken)
    {
        if (string.IsNullOrEmpty(suppliedToken))
        {
            return false;
        }

        var suppliedBytes = Encoding.UTF8.GetBytes(suppliedToken);

        return suppliedBytes.Length == _expectedToken.Length &&
            CryptographicOperations.FixedTimeEquals(
                suppliedBytes,
                _expectedToken);
    }
}
