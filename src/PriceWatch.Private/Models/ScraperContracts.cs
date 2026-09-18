using System.Text.Json.Serialization;

namespace PriceWatch.Private.Models;

public sealed class ScrapeBatchRequest
{
    [JsonPropertyName("headless")]
    public bool Headless { get; init; } = true;

    [JsonPropertyName("jobs")]
    public List<ScrapeJob> Jobs { get; init; } = [];
}

public sealed class ScrapeJob
{
    [JsonPropertyName("item_id")]
    public Guid ItemId { get; init; }

    [JsonPropertyName("source_id")]
    public long SourceId { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("store")]
    public string Store { get; init; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; init; } = string.Empty;
}

public sealed class ScrapeBatchResponse
{
    [JsonPropertyName("results")]
    public List<ScrapeWorkerResult> Results { get; init; } = [];
}

public sealed class ScrapeWorkerResult
{
    [JsonPropertyName("item_id")]
    public Guid ItemId { get; init; }

    [JsonPropertyName("source_id")]
    public long SourceId { get; init; }

    [JsonPropertyName("ok")]
    public bool Ok { get; init; }

    [JsonPropertyName("price")]
    public decimal? Price { get; init; }

    [JsonPropertyName("method")]
    public string? Method { get; init; }

    [JsonPropertyName("final_url")]
    public string? FinalUrl { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }
}
