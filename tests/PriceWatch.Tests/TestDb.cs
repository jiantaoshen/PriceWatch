using Microsoft.EntityFrameworkCore;
using PriceWatch.Data;

namespace PriceWatch.Tests;

internal static class TestDb
{
    public static PriceWatchDbContext Create()
    {
        var options = new DbContextOptionsBuilder<PriceWatchDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new PriceWatchDbContext(options);
    }
}
