using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PriceWatch.Data;

public sealed class PriceWatchDbContextFactory
    : IDesignTimeDbContextFactory<PriceWatchDbContext>
{
   public PriceWatchDbContext CreateDbContext(string[] args)
{
    var connectionString =
        Environment.GetEnvironmentVariable(
            "ConnectionStrings__Database");

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "ConnectionStrings__Database is required for EF design-time operations.");
    }

    var optionsBuilder =
        new DbContextOptionsBuilder<PriceWatchDbContext>();

    optionsBuilder
        .UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention();

    return new PriceWatchDbContext(
        optionsBuilder.Options);
}
}