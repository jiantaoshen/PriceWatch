// ============================================================================
// File: Services/SubscriptionService.cs
// Purpose:
//   Persists recurring subscriptions independently from scraper products in
//   data/subscriptions.json. No subscription is passed to the Python scraper.
//
// Main functions:
//   - GetAllAsync(): return all active and cancelled subscriptions.
//   - GetByIdAsync(id): return one subscription.
//   - CreateAsync(input): create a subscription.
//   - UpdateAsync(id, input): replace user-editable subscription fields.
//   - SetActiveAsync(id, isActive): activate or cancel without deleting history.
//   - DeleteAsync(id): permanently delete a subscription.
//
// Inputs:
//   Current-format data/subscriptions.json and SubscriptionInput API payloads.
//
// Outputs:
//   Subscription objects and an atomically rewritten subscriptions.json file.
// ============================================================================

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

using PriceWatch.Api.DTOs;
using PriceWatch.Api.Models;

namespace PriceWatch.Api.Services;


public sealed class SubscriptionService
{
    private readonly string _subscriptionsFile;
    private readonly SemaphoreSlim _writeLock = new(1, 1);

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase),
        },
    };


    public SubscriptionService(AppPaths paths)
    {
        _subscriptionsFile = paths.SubscriptionsFile;
    }


    public async Task<List<Subscription>> GetAllAsync()
    {
        if (!File.Exists(_subscriptionsFile)) return [];

        try
        {
            var json = await File.ReadAllTextAsync(_subscriptionsFile);
            if (string.IsNullOrWhiteSpace(json)) return [];

            return JsonSerializer.Deserialize<List<Subscription>>(
                json,
                _jsonOptions
            ) ?? [];
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException(
                "subscriptions.json does not match the current Subscription schema.",
                exception
            );
        }
    }


    public async Task<Subscription> GetByIdAsync(string id)
    {
        RequireId(id);
        var items = await GetAllAsync();
        return FindRequired(items, id);
    }


    public async Task<Subscription> CreateAsync(SubscriptionInput input)
    {
        ValidateInput(input);

        await _writeLock.WaitAsync();
        try
        {
            var items = await GetAllAsync();
            var item = MapSubscription(
                GenerateId(items),
                input,
                isActive: true
            );
            items.Add(item);
            await SaveAsync(items);
            return item;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    public async Task<Subscription> UpdateAsync(
        string id,
        SubscriptionInput input
    )
    {
        RequireId(id);
        ValidateInput(input);

        await _writeLock.WaitAsync();
        try
        {
            var items = await GetAllAsync();
            var index = FindIndexRequired(items, id);
            var existing = items[index];
            var updated = MapSubscription(
                existing.Id,
                input,
                isActive: existing.IsActive
            );

            items[index] = updated;
            await SaveAsync(items);
            return updated;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    public async Task<Subscription> SetActiveAsync(
        string id,
        bool isActive
    )
    {
        RequireId(id);

        await _writeLock.WaitAsync();
        try
        {
            var items = await GetAllAsync();
            var index = FindIndexRequired(items, id);
            var source = items[index];

            var updated = new Subscription
            {
                Id = source.Id,
                Name = source.Name,
                Price = source.Price,
                Currency = source.Currency,
                BillingInterval = source.BillingInterval,
                NextBillingDate = source.NextBillingDate,
                IsActive = isActive,
                Note = source.Note,
            };

            items[index] = updated;
            await SaveAsync(items);
            return updated;
        }
        finally
        {
            _writeLock.Release();
        }
    }


    public async Task DeleteAsync(string id)
    {
        RequireId(id);

        await _writeLock.WaitAsync();
        try
        {
            var items = await GetAllAsync();
            var removed = items.RemoveAll(item => string.Equals(
                item.Id,
                id,
                StringComparison.OrdinalIgnoreCase
            ));

            if (removed == 0)
            {
                throw new KeyNotFoundException("Subscription not found.");
            }

            await SaveAsync(items);
        }
        finally
        {
            _writeLock.Release();
        }
    }


    private async Task SaveAsync(List<Subscription> items)
    {
        var directory = Path.GetDirectoryName(_subscriptionsFile);
        if (string.IsNullOrWhiteSpace(directory))
        {
            throw new InvalidOperationException(
                "Unable to determine the subscriptions directory."
            );
        }

        Directory.CreateDirectory(directory);

        var json = JsonSerializer.Serialize(items, _jsonOptions);
        var tempFile = _subscriptionsFile + ".tmp";

        try
        {
            await File.WriteAllTextAsync(
                tempFile,
                json + Environment.NewLine,
                new UTF8Encoding(false)
            );
            File.Move(tempFile, _subscriptionsFile, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }


    private static void ValidateInput(SubscriptionInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
        {
            throw new ArgumentException("Subscription name is required.");
        }

        if (!double.IsFinite(input.Price) || input.Price <= 0)
        {
            throw new ArgumentException("Subscription price must be greater than 0.");
        }

        if (string.IsNullOrWhiteSpace(input.Currency))
        {
            throw new ArgumentException("Currency is required.");
        }
    }


    private static Subscription MapSubscription(
        string id,
        SubscriptionInput input,
        bool isActive
    )
    {
        return new Subscription
        {
            Id = id,
            Name = input.Name.Trim(),
            Price = input.Price,
            Currency = input.Currency.Trim().ToUpperInvariant(),
            BillingInterval = input.BillingInterval,
            NextBillingDate = input.NextBillingDate,
            IsActive = isActive,
            Note = string.IsNullOrWhiteSpace(input.Note)
                ? null
                : input.Note.Trim(),
        };
    }


    private static Subscription FindRequired(
        IEnumerable<Subscription> items,
        string id
    )
    {
        return items.FirstOrDefault(item => string.Equals(
            item.Id,
            id,
            StringComparison.OrdinalIgnoreCase
        )) ?? throw new KeyNotFoundException("Subscription not found.");
    }


    private static int FindIndexRequired(
        IReadOnlyList<Subscription> items,
        string id
    )
    {
        for (var index = 0; index < items.Count; index++)
        {
            if (string.Equals(
                items[index].Id,
                id,
                StringComparison.OrdinalIgnoreCase
            ))
            {
                return index;
            }
        }

        throw new KeyNotFoundException("Subscription not found.");
    }


    private static string GenerateId(IEnumerable<Subscription> items)
    {
        string id;
        do
        {
            id = Guid.NewGuid().ToString("N")[..16];
        }
        while (items.Any(item => string.Equals(
            item.Id,
            id,
            StringComparison.OrdinalIgnoreCase
        )));

        return id;
    }


    private static void RequireId(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("Subscription ID is required.");
        }
    }
}
