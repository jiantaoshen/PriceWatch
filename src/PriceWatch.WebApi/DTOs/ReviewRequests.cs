namespace PriceWatch.WebApi.DTOs;

public sealed class RejectReviewRequest
{
    public string? Note { get; init; }
}

public sealed class ManualReviewRequest
{
    public decimal Price { get; init; }

    public decimal Quantity { get; init; } = 1m;

    public string? Note { get; init; }
}