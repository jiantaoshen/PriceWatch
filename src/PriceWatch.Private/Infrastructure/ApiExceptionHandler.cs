using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace PriceWatch.Private.Infrastructure;

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

        // Do not log Exception.ToString()/Message here. Some providers include
        // connection strings, credentials, URLs, or other sensitive values in
        // exception messages. The stack trace is kept for diagnostics without
        // echoing the exception payload itself.
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
