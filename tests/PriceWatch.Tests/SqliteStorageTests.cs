using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;
using PriceWatch.Data.Entities;

namespace PriceWatch.Tests;

public sealed class SqliteStorageTests
{
    [Fact]
    public async Task Sqlite_stores_guids_utc_times_and_unit_prices()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=True");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<PriceWatchDbContext>()
            .UseSqlite(connection)
            .UseSnakeCaseNamingConvention()
            .Options;

        var id = Guid.NewGuid();
        var at = new DateTimeOffset(2026, 11, 1, 12, 30, 0, TimeSpan.Zero);
        await using (var db = new PriceWatchDbContext(options))
        {
            await db.Database.EnsureCreatedAsync();
            var item = new TrackedItem
            {
                Id = id, Name = "Local test item", ItemType = ItemType.Product,
                Currency = "SEK", ComparisonQuantity = 3m,
                TargetPrice = 10m, CurrentPrice = 10m,
                CurrentQuantity = 3m,
                CreatedAt = at, UpdatedAt = at
            };
            db.TrackedItems.Add(item);
            await db.SaveChangesAsync();
        }
        await using (var db = new PriceWatchDbContext(options))
        {
            var restored = await db.TrackedItems.SingleAsync(x => x.Id == id);
            Assert.Equal(10m, restored.CurrentPrice);
            Assert.Equal(3.333333m, restored.CurrentUnitPrice);
            Assert.Equal(3.333333m, restored.TargetUnitPrice);
            Assert.Equal(at, restored.CreatedAt);
        }
    }
}
