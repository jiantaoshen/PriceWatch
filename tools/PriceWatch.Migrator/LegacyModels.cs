using System.Text.Json.Serialization;

namespace PriceWatch.Migrator;

internal sealed class LegacyProduct
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("scraping_enabled")]
    public bool ScrapingEnabled { get; set; }

    [JsonPropertyName("comparison_quantity")]
    public decimal? ComparisonQuantity { get; set; }

    [JsonPropertyName("sources")]
    public List<LegacySource> Sources { get; set; } = [];

    [JsonPropertyName("target_price")]
    public decimal? TargetPrice { get; set; }

    [JsonPropertyName("target_unit_price")]
    public decimal? TargetUnitPrice { get; set; }

    [JsonPropertyName("unit")]
    public string? Unit { get; set; }

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "SEK";

    [JsonPropertyName("last_purchase_price")]
    public decimal? LastPurchasePrice { get; set; }

    [JsonPropertyName("last_purchase_date")]
    public string? LastPurchaseDate { get; set; }

    [JsonPropertyName("archived_at")]
    public string? ArchivedAt { get; set; }
}

internal sealed class LegacySource
{
    [JsonPropertyName("store")]
    public string Store { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("scraping_enabled")]
    public bool ScrapingEnabled { get; set; }

    [JsonPropertyName("manual_price")]
    public decimal? ManualPrice { get; set; }

    [JsonPropertyName("unit_quantity")]
    public decimal? UnitQuantity { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}

internal sealed class LegacyHistoryFile
{
    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("generated_at")]
    public DateTimeOffset GeneratedAt { get; set; }

    [JsonPropertyName("data")]
    public List<LegacyHistoryRow> Data { get; set; } = [];
}

internal sealed class LegacyHistoryRow
{
    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("current_price")]
    public decimal? CurrentPrice { get; set; }

    [JsonPropertyName("current_unit_price")]
    public decimal? CurrentUnitPrice { get; set; }
}

internal sealed class LegacyLatestFile
{
    [JsonPropertyName("period")]
    public string Period { get; set; } = string.Empty;

    [JsonPropertyName("generated_at")]
    public DateTimeOffset GeneratedAt { get; set; }

    [JsonPropertyName("data")]
    public List<LegacyLatestItem> Data { get; set; } = [];
}

internal sealed class LegacyLatestItem
{
    [JsonPropertyName("product_id")]
    public string ProductId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("store")]
    public string? Store { get; set; }

    [JsonPropertyName("target_price")]
    public decimal? TargetPrice { get; set; }

    [JsonPropertyName("current_price")]
    public decimal? CurrentPrice { get; set; }

    [JsonPropertyName("previous_price")]
    public decimal? PreviousPrice { get; set; }

    [JsonPropertyName("current_unit_price")]
    public decimal? CurrentUnitPrice { get; set; }

    [JsonPropertyName("previous_unit_price")]
    public decimal? PreviousUnitPrice { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("currency")]
    public string Currency { get; set; } = "SEK";

    [JsonPropertyName("offers")]
    public List<LegacyOffer> Offers { get; set; } = [];

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("reviewed_by_user")]
    public bool ReviewedByUser { get; set; }

    [JsonPropertyName("review_method")]
    public string? ReviewMethod { get; set; }

    [JsonPropertyName("reviewed_at")]
    public DateTimeOffset? ReviewedAt { get; set; }
}

internal sealed class LegacyOffer
{
    [JsonPropertyName("store")]
    public string Store { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("price")]
    public decimal? Price { get; set; }

    [JsonPropertyName("price_source")]
    public string PriceSource { get; set; } = string.Empty;

    [JsonPropertyName("unit_quantity")]
    public decimal? UnitQuantity { get; set; }

    [JsonPropertyName("unit_price")]
    public decimal? UnitPrice { get; set; }

    [JsonPropertyName("comparison_price")]
    public decimal? ComparisonPrice { get; set; }

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}

internal sealed class LegacyRun
{
    [JsonPropertyName("run_id")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("started_at")]
    public DateTimeOffset StartedAt { get; set; }

    [JsonPropertyName("finished_at")]
    public DateTimeOffset? FinishedAt { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("total_products")]
    public int TotalProducts { get; set; }

    [JsonPropertyName("successful")]
    public int Successful { get; set; }

    [JsonPropertyName("failed")]
    public int Failed { get; set; }

    [JsonPropertyName("suspicious")]
    public int Suspicious { get; set; }
}

internal sealed class LegacySchedule
{
    public bool Enabled { get; set; }

    public string? Day { get; set; }

    public string? Time { get; set; }

    public bool RunIfMissed { get; set; }
}
