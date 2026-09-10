// ============================================================================
// File: Services/ProductConfigService.cs
// Purpose:
//   Owns reading, validating, creating, editing, deleting, lifecycle updates and
//   source-level manual price overrides for python/products.json. Normal edits
//   preserve ownership/subscription fields unless a lifecycle action changes them.
//
// Main functions:
//   - GetAllAsync(): returns all saved ProductConfig records.
//   - GetByIdAsync(id): returns one ProductConfig or throws if it does not exist.
//   - CreateAsync(input): creates a new Tracked product.
//   - UpdateAsync(id, input): updates scraper config while preserving lifecycle.
//   - MarkOwnedAsync(id, input): marks product Owned and clears subscription data.
//   - MarkSubscriptionAsync(id, input): marks Subscription and clears purchase data.
//   - MarkTrackedAsync(id): returns product to Tracked and clears lifecycle data.
//   - SetManualSourcePriceAsync(id, input): switch one source to trusted manual mode.
//   - DeleteAsync(id): removes a product.
//
// Inputs:
//   Current-format python/products.json, ProductConfigInput for scraper configuration,
//   lifecycle DTOs, and SetManualSourcePriceInput for a user-entered source price.
//
// Outputs:
//   ProductConfig objects and an atomically rewritten python/products.json file.
// ============================================================================

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

using PriceWatch.Api.DTOs;
using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;


public sealed class ProductConfigService
{
    private readonly string _productsFile;
    private readonly SemaphoreSlim _writeLock = new(1, 1);

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase),
        },
    };


    public ProductConfigService(AppPaths paths)
    {
        _productsFile = paths.ProductsFile;
    }


    // ========================================================================
    // Read
    // ========================================================================

    public async Task<List<ProductConfig>> GetAllAsync()
    {
        if (!File.Exists(_productsFile)) return [];

        try
        {
            var json = await File.ReadAllTextAsync(_productsFile);

            if (string.IsNullOrWhiteSpace(json)) return [];

            return JsonSerializer.Deserialize<List<ProductConfig>>(
                json,
                _jsonOptions
            ) ?? [];
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException(
                "products.json contains invalid JSON.",
                exception
            );
        }
    }


    public async Task<ProductConfig> GetByIdAsync(string id)
    {
        RequireId(id);

        var products = await GetAllAsync();
        return FindRequired(products, id);
    }


    // ========================================================================
    // Create / normal scraper-config update
    // ========================================================================

    public async Task<ProductConfig> CreateAsync(ProductConfigInput input)
    {
        ValidateProductInput(input);

        await _writeLock.WaitAsync();

        try
        {
            var products = await GetAllAsync();

            var product = MapProduct(
                GenerateId(products),
                input,
                lifecycleSource: null
            );

            products.Add(product);
            await SaveAsync(products);

            return product;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    public async Task<ProductConfig> UpdateAsync(
        string id,
        ProductConfigInput input
    )
    {
        RequireId(id);
        ValidateProductInput(input);

        await _writeLock.WaitAsync();

        try
        {
            var products = await GetAllAsync();
            var index = FindIndexRequired(products, id);
            var existing = products[index];

            // Important: a normal edit only updates scraper-oriented fields.
            // Purchase/subscription lifecycle data survives the edit.
            var updated = MapProduct(
                existing.Id,
                input,
                lifecycleSource: existing
            );

            products[index] = updated;
            await SaveAsync(products);

            return updated;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    // ========================================================================
    // Lifecycle actions
    // ========================================================================

    public async Task<ProductConfig> MarkOwnedAsync(
        string id,
        MarkProductOwnedInput input
    )
    {
        RequireId(id);
        ValidateOptionalPositive(input.PurchasePrice, "Purchase price");

        return await UpdateLifecycleAsync(
            id,
            existing => CopyWithLifecycle(
                existing,
                savedType: SavedProductType.Owned,
                purchasePrice: input.PurchasePrice,
                purchaseDate: input.PurchaseDate,
                subscriptionPrice: null,
                billingInterval: null,
                nextBillingDate: null
            )
        );
    }


    public async Task<ProductConfig> MarkSubscriptionAsync(
        string id,
        MarkSubscriptionInput input
    )
    {
        RequireId(id);
        ValidateOptionalPositive(input.SubscriptionPrice, "Subscription price");

        return await UpdateLifecycleAsync(
            id,
            existing => CopyWithLifecycle(
                existing,
                savedType: SavedProductType.Subscription,
                purchasePrice: null,
                purchaseDate: null,
                subscriptionPrice: input.SubscriptionPrice,
                billingInterval: input.BillingInterval,
                nextBillingDate: input.NextBillingDate
            )
        );
    }


    public async Task<ProductConfig> MarkTrackedAsync(string id)
    {
        RequireId(id);

        return await UpdateLifecycleAsync(
            id,
            existing => CopyWithLifecycle(
                existing,
                savedType: SavedProductType.Tracked,
                purchasePrice: null,
                purchaseDate: null,
                subscriptionPrice: null,
                billingInterval: null,
                nextBillingDate: null
            )
        );
    }


    private async Task<ProductConfig> UpdateLifecycleAsync(
        string id,
        Func<ProductConfig, ProductConfig> update
    )
    {
        await _writeLock.WaitAsync();

        try
        {
            var products = await GetAllAsync();
            var index = FindIndexRequired(products, id);

            var updated = update(products[index]);
            products[index] = updated;

            await SaveAsync(products);
            return updated;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    // ========================================================================
    // Price review / manual source override
    // ========================================================================

    public async Task<ProductConfig> SetManualSourcePriceAsync(
        string id,
        SetManualSourcePriceInput input
    )
    {
        RequireId(id);

        if (string.IsNullOrWhiteSpace(input.SourceUrl))
        {
            throw new ArgumentException("Source URL is required.");
        }

        RequirePositive(input.ManualPrice, "Manual price");

        await _writeLock.WaitAsync();

        try
        {
            var products = await GetAllAsync();
            var index = FindIndexRequired(products, id);
            var existing = products[index];
            var sourceUrl = input.SourceUrl.Trim();
            var found = false;

            var sources = existing.Sources
                .Select(source =>
                {
                    if (!string.Equals(
                        source.Url,
                        sourceUrl,
                        StringComparison.OrdinalIgnoreCase
                    ))
                    {
                        return source;
                    }

                    found = true;

                    return new ProductSource
                    {
                        Store = source.Store,
                        Url = source.Url,
                        ScrapingEnabled = false,
                        ManualPrice = input.ManualPrice,
                        UnitQuantity = source.UnitQuantity,
                        Note = source.Note,
                    };
                })
                .ToList();

            if (!found)
            {
                throw new ArgumentException(
                    "The selected source does not belong to this product."
                );
            }

            var updated = CopyWithSources(existing, sources);
            products[index] = updated;
            await SaveAsync(products);

            return updated;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    // ========================================================================
    // Delete
    // ========================================================================

    public async Task DeleteAsync(string id)
    {
        RequireId(id);

        await _writeLock.WaitAsync();

        try
        {
            var products = await GetAllAsync();

            var removed = products.RemoveAll(
                product => string.Equals(
                    product.Id,
                    id,
                    StringComparison.OrdinalIgnoreCase
                )
            );

            if (removed == 0)
            {
                throw new KeyNotFoundException("Product not found.");
            }

            await SaveAsync(products);
        }
        finally
        {
            _writeLock.Release();
        }
    }


    // ========================================================================
    // Persistence
    // ========================================================================

    private async Task SaveAsync(List<ProductConfig> products)
    {
        var directory = Path.GetDirectoryName(_productsFile);

        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new InvalidOperationException(
                "Unable to determine the products directory."
            );
        }

        Directory.CreateDirectory(directory);

        var json = JsonSerializer.Serialize(products, _jsonOptions);
        var tempFile = _productsFile + ".tmp";

        try
        {
            await File.WriteAllTextAsync(
                tempFile,
                json + Environment.NewLine,
                new UTF8Encoding(false)
            );

            File.Move(tempFile, _productsFile, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }


    // ========================================================================
    // Validation
    // ========================================================================

    private static void ValidateProductInput(ProductConfigInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
        {
            throw new ArgumentException("Product name is required.");
        }

        if (input.Sources is null || input.Sources.Count == 0)
        {
            throw new ArgumentException(
                "At least one store source is required."
            );
        }

        RequirePositive(input.TargetPrice, "Target price");
        ValidateOptionalPositive(input.TargetUnitPrice, "Target unit price");
        ValidateOptionalPositive(input.ComparisonQuantity, "Comparison quantity");

        if (string.IsNullOrWhiteSpace(input.Currency))
        {
            throw new ArgumentException("Currency is required.");
        }

        var urls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var hasUnitQuantity = false;

        for (var index = 0; index < input.Sources.Count; index++)
        {
            var source = input.Sources[index];
            var number = index + 1;

            if (string.IsNullOrWhiteSpace(source.Store))
            {
                throw new ArgumentException(
                    $"Store {number}: name is required."
                );
            }

            ValidateUrl(source.Url, number, urls);

            if (source.UnitQuantity is not null)
            {
                hasUnitQuantity = true;
                RequirePositive(
                    source.UnitQuantity.Value,
                    $"Store {number}: unit quantity"
                );
            }

            ValidateOptionalPositive(
                source.ManualPrice,
                $"Store {number}: manual price"
            );

            var shouldScrape =
                input.ScrapingEnabled &&
                source.ScrapingEnabled;

            if (!shouldScrape && source.ManualPrice is null)
            {
                throw new ArgumentException(
                    $"Store {number}: manual price is required when scraping is disabled."
                );
            }
        }

        var needsUnit =
            hasUnitQuantity ||
            input.TargetUnitPrice is not null ||
            input.ComparisonQuantity is not null;

        if (needsUnit && string.IsNullOrWhiteSpace(input.Unit))
        {
            throw new ArgumentException(
                "Unit is required when comparison or unit price tracking is enabled."
            );
        }
    }


    private static void ValidateUrl(
        string url,
        int number,
        HashSet<string> urls
    )
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new ArgumentException(
                $"Store {number}: URL is required."
            );
        }

        var trimmed = url.Trim();

        if (
            !Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp &&
             uri.Scheme != Uri.UriSchemeHttps)
        )
        {
            throw new ArgumentException(
                $"Store {number}: URL must use http:// or https://."
            );
        }

        if (!urls.Add(trimmed))
        {
            throw new ArgumentException("Store URLs must be unique.");
        }
    }


    private static void ValidateOptionalPositive(
        double? value,
        string label
    )
    {
        if (value is not null)
        {
            RequirePositive(value.Value, label);
        }
    }


    private static void RequirePositive(double value, string label)
    {
        if (!double.IsFinite(value) || value <= 0)
        {
            throw new ArgumentException(
                $"{label} must be greater than 0."
            );
        }
    }


    private static void RequireId(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("Product ID is required.");
        }
    }


    // ========================================================================
    // Lookup / ID helpers
    // ========================================================================

    private static ProductConfig FindRequired(
        IEnumerable<ProductConfig> products,
        string id
    )
    {
        return products.FirstOrDefault(
            product => string.Equals(
                product.Id,
                id,
                StringComparison.OrdinalIgnoreCase
            )
        ) ?? throw new KeyNotFoundException("Product not found.");
    }


    private static int FindIndexRequired(
        IReadOnlyList<ProductConfig> products,
        string id
    )
    {
        for (var index = 0; index < products.Count; index++)
        {
            if (string.Equals(
                products[index].Id,
                id,
                StringComparison.OrdinalIgnoreCase
            ))
            {
                return index;
            }
        }

        throw new KeyNotFoundException("Product not found.");
    }


    private static string GenerateId(
        IEnumerable<ProductConfig> products
    )
    {
        string id;

        do
        {
            id = Guid.NewGuid().ToString("N")[..16];
        }
        while (
            products.Any(
                product => string.Equals(
                    product.Id,
                    id,
                    StringComparison.OrdinalIgnoreCase
                )
            )
        );

        return id;
    }


    // ========================================================================
    // Mapping
    // ========================================================================

    private static ProductConfig MapProduct(
        string id,
        ProductConfigInput input,
        ProductConfig? lifecycleSource
    )
    {
        return new ProductConfig
        {
            Id = id,
            Name = input.Name.Trim(),
            SavedType = lifecycleSource?.SavedType ?? SavedProductType.Tracked,
            ScrapingEnabled = input.ScrapingEnabled,
            ComparisonQuantity = input.ComparisonQuantity,

            Sources = input.Sources
                .Select(source => new ProductSource
                {
                    Store = source.Store.Trim(),
                    Url = source.Url.Trim(),
                    ScrapingEnabled = source.ScrapingEnabled,
                    ManualPrice = source.ManualPrice,
                    UnitQuantity = source.UnitQuantity,
                    Note = Clean(source.Note),
                })
                .ToList(),

            TargetPrice = input.TargetPrice,
            TargetUnitPrice = input.TargetUnitPrice,
            Unit = Clean(input.Unit),
            Currency = input.Currency.Trim().ToUpperInvariant(),

            PurchasePrice = lifecycleSource?.PurchasePrice,
            PurchaseDate = lifecycleSource?.PurchaseDate,

            SubscriptionPrice = lifecycleSource?.SubscriptionPrice,
            BillingInterval = lifecycleSource?.BillingInterval,
            NextBillingDate = lifecycleSource?.NextBillingDate,
        };
    }


    private static ProductConfig CopyWithLifecycle(
        ProductConfig source,
        SavedProductType savedType,
        double? purchasePrice,
        DateOnly? purchaseDate,
        double? subscriptionPrice,
        BillingInterval? billingInterval,
        DateOnly? nextBillingDate
    )
    {
        return new ProductConfig
        {
            Id = source.Id,
            Name = source.Name,
            SavedType = savedType,
            ScrapingEnabled = source.ScrapingEnabled,
            ComparisonQuantity = source.ComparisonQuantity,
            Sources = source.Sources,
            TargetPrice = source.TargetPrice,
            TargetUnitPrice = source.TargetUnitPrice,
            Unit = source.Unit,
            Currency = source.Currency,

            PurchasePrice = purchasePrice,
            PurchaseDate = purchaseDate,

            SubscriptionPrice = subscriptionPrice,
            BillingInterval = billingInterval,
            NextBillingDate = nextBillingDate,
        };
    }


    private static ProductConfig CopyWithSources(
        ProductConfig source,
        List<ProductSource> sources
    )
    {
        return new ProductConfig
        {
            Id = source.Id,
            Name = source.Name,
            SavedType = source.SavedType,
            ScrapingEnabled = source.ScrapingEnabled,
            ComparisonQuantity = source.ComparisonQuantity,
            Sources = sources,
            TargetPrice = source.TargetPrice,
            TargetUnitPrice = source.TargetUnitPrice,
            Unit = source.Unit,
            Currency = source.Currency,

            PurchasePrice = source.PurchasePrice,
            PurchaseDate = source.PurchaseDate,

            SubscriptionPrice = source.SubscriptionPrice,
            BillingInterval = source.BillingInterval,
            NextBillingDate = source.NextBillingDate,
        };
    }


    private static string? Clean(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}
