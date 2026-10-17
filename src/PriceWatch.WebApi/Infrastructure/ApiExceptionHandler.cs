using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace PriceWatch.WebApi.Infrastructure;

public sealed class ApiExceptionHandler(
    ILogger<ApiExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var traceId =
            Activity.Current?.Id
            ?? httpContext.TraceIdentifier;

        // Never log the raw exception payload here. Provider exception messages
        // can contain connection strings, credentials, URLs, or other secrets.
        logger.LogError(
            "Unhandled API exception. Type={ExceptionType}, TraceId={TraceId}, StackTrace={StackTrace}",
            exception.GetType().FullName,
            traceId,
            exception.StackTrace);

        httpContext.Response.StatusCode =
            StatusCodes.Status500InternalServerError;

        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Internal server error",
                Detail = "An unexpected error occurred.",
                Instance = httpContext.Request.Path,
                Extensions =
                {
                    ["traceId"] = traceId
                }
            },
            cancellationToken);

        return true;
    }
}
