using System.Text.Json;
using System.Text.Json.Serialization;

using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;

public sealed class AiProductContextService
{
    private readonly AppPaths _paths;
    private readonly ProductConfigService _products;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public AiProductContextService(
        AppPaths paths,
        ProductConfigService products
    )
    {
        _paths = paths;
        _products = products;
    }

    public async Task<IReadOnlyList<AiProductContext>> BuildAsync(
        IEnumerable<string> productIds,
        CancellationToken cancellationToken
    )
    {
        var ids = productIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (ids.Count == 0)
            return [];

        var configs = await _products.GetAllAsync();

        var selected = ids
            .Select(id =>
                configs.FirstOrDefault(product =>
                    string.Equals(
                        product.Id,
                        id,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                ?? throw new ArgumentException($"Product not found: {id}")
            )
            .ToList();

        var latest = await LoadAsync<SnapshotFile>(
            _paths.LatestFile,
            cancellationToken
        );

        var historyFiles = await LoadHistoryAsync(cancellationToken);

        var result = new List<AiProductContext>();

        foreach (var config in selected)
        {
            var current = FindProduct(
                latest?.Data,
                config.Id,
                config.Name
            );

            var history = new List<AiPricePoint>();

            foreach (var snapshot in historyFiles)
            {
                var product = FindProduct(
                    snapshot.Data,
                    config.Id,
                    config.Name
                );

                if (product?.CurrentPrice is not double price)
                    continue;

                history.Add(new AiPricePoint
                {
                    Date = snapshot.Period,
                    Price = price,
                });
            }

            var prices = history
                .Select(item => item.Price)
                .ToList();

            var historicalLow =
                prices.Count > 0
                    ? prices.Min()
                    : current?.CurrentPrice;

            var historicalHigh =
                prices.Count > 0
                    ? prices.Max()
                    : current?.CurrentPrice;

            var historicalAverage =
                prices.Count > 0
                    ? prices.Average()
                    : current?.CurrentPrice;

            result.Add(new AiProductContext
            {
                ProductId = config.Id,
                Name = config.Name,
                Currency = config.Currency,

                CurrentPrice = current?.CurrentPrice,
                TargetPrice = config.TargetPrice,
                PreviousPrice = current?.PreviousPrice,

                HistoricalLow = historicalLow,
                HistoricalHigh = historicalHigh,
                HistoricalAverage = historicalAverage,

                History = history,
            });
        }

        return result;
    }

    private async Task<List<SnapshotFile>> LoadHistoryAsync(
        CancellationToken cancellationToken
    )
    {
        var indexFile = Path.Combine(
            _paths.HistoryDirectory,
            "index.json"
        );

        var index = await LoadAsync<HistoryIndex>(
            indexFile,
            cancellationToken
        );

        if (index?.Periods is null)
            return [];

        var result = new List<SnapshotFile>();

        foreach (var period in index.Periods)
        {
            if (
                string.IsNullOrWhiteSpace(period) ||
                Path.GetFileName(period) != period
            )
            {
                continue;
            }

            var path = Path.Combine(
                _paths.HistoryDirectory,
                $"{period}.json"
            );

            var snapshot = await LoadAsync<SnapshotFile>(
                path,
                cancellationToken
            );

            if (snapshot is null)
                continue;

            if (string.IsNullOrWhiteSpace(snapshot.Period))
                snapshot.Period = period;

            result.Add(snapshot);
        }

        return result;
    }

    private static SnapshotProduct? FindProduct(
        IEnumerable<SnapshotProduct>? products,
        string id,
        string name
    )
    {
        if (products is null)
            return null;

        return products.FirstOrDefault(product =>
                   string.Equals(
                       product.ProductId,
                       id,
                       StringComparison.OrdinalIgnoreCase
                   )
               )
               ?? products.FirstOrDefault(product =>
                   string.Equals(
                       product.Name,
                       name,
                       StringComparison.OrdinalIgnoreCase
                   )
               );
    }

    private static async Task<T?> LoadAsync<T>(
        string path,
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(path))
            return default;

        try
        {
            await using var stream = File.OpenRead(path);

            return await JsonSerializer.DeserializeAsync<T>(
                stream,
                JsonOptions,
                cancellationToken
            );
        }
        catch (JsonException)
        {
            return default;
        }
        catch (IOException)
        {
            return default;
        }
    }

    private sealed class HistoryIndex
    {
        [JsonPropertyName("periods")]
        public List<string> Periods { get; init; } = [];
    }

    private sealed class SnapshotFile
    {
        [JsonPropertyName("period")]
        public string Period { get; set; } = "";

        [JsonPropertyName("data")]
        public List<SnapshotProduct> Data { get; init; } = [];
    }

    private sealed class SnapshotProduct
    {
        [JsonPropertyName("product_id")]
        public string ProductId { get; init; } = "";

        [JsonPropertyName("name")]
        public string Name { get; init; } = "";

        [JsonPropertyName("current_price")]
        public double? CurrentPrice { get; init; }

        [JsonPropertyName("previous_price")]
        public double? PreviousPrice { get; init; }
    }
}
