using Microsoft.EntityFrameworkCore;
using PriceWatch.Data.Entities;

namespace PriceWatch.Data;

public class PriceWatchDbContext : DbContext
{
    public PriceWatchDbContext(DbContextOptions<PriceWatchDbContext> options)
        : base(options)
    {
    }

    public DbSet<TrackedItem> TrackedItems => Set<TrackedItem>();
    public DbSet<ItemSource> ItemSources => Set<ItemSource>();
    public DbSet<PriceObservation> PriceObservations => Set<PriceObservation>();
    public DbSet<BestPriceState> BestPriceStates => Set<BestPriceState>();
    public DbSet<BestPriceStateSource> BestPriceStateSources => Set<BestPriceStateSource>();
    public DbSet<ScrapeRun> ScrapeRuns => Set<ScrapeRun>();
    public DbSet<ScrapeResult> ScrapeResults => Set<ScrapeResult>();
    public DbSet<PriceAlertEvent> PriceAlertEvents => Set<PriceAlertEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TrackedItem>(entity =>
        {
            entity.ToTable("tracked_items", table =>
            {
                table.HasCheckConstraint(
                    "ck_tracked_items_comparison_quantity_positive",
                    "comparison_quantity > 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_target_price_nonnegative",
                    "target_price IS NULL OR target_price >= 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_check_interval_positive",
                    "check_interval_minutes IS NULL OR check_interval_minutes > 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_current_price_nonnegative",
                    "current_price IS NULL OR current_price >= 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_current_quantity_positive",
                    "current_quantity IS NULL OR current_quantity > 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_previous_price_nonnegative",
                    "previous_price IS NULL OR previous_price >= 0");
                table.HasCheckConstraint(
                    "ck_tracked_items_previous_quantity_positive",
                    "previous_quantity IS NULL OR previous_quantity > 0");
            });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Name)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Currency)
                .HasMaxLength(3)
                .IsRequired();

            entity.Property(x => x.Unit)
                .HasMaxLength(32);

            entity.Property(x => x.ItemType)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(x => x.TargetPrice)
                .HasPrecision(18, 4);

            entity.Property(x => x.ComparisonQuantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.TargetUnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    """
                    CASE
                        WHEN target_price IS NULL
                        THEN NULL
                        ELSE target_price / comparison_quantity
                    END
                    """,
                    stored: true);

            ConfigureComputedPrice(
                entity.Property(x => x.CurrentPrice),
                entity.Property(x => x.CurrentQuantity),
                entity.Property(x => x.CurrentUnitPrice),
                "current_price",
                "current_quantity");

            ConfigureComputedPrice(
                entity.Property(x => x.PreviousPrice),
                entity.Property(x => x.PreviousQuantity),
                entity.Property(x => x.PreviousUnitPrice),
                "previous_price",
                "previous_quantity");

            entity.HasMany(x => x.Sources)
                .WithOne(x => x.Item)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.Observations)
                .WithOne(x => x.Item)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.BestPriceHistory)
                .WithOne(x => x.Item)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.ItemType);
            entity.HasIndex(x => x.ArchivedAt);
        });

        modelBuilder.Entity<ItemSource>(entity =>
        {
            entity.ToTable("item_sources", table =>
            {
                table.HasCheckConstraint(
                    "ck_item_sources_default_quantity_positive",
                    "default_quantity > 0");
            });

            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.ItemId, x.Id });

            entity.Property(x => x.Store)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.DefaultQuantity)
                .HasPrecision(18, 4);

            entity.HasIndex(x => x.ItemId);
            entity.HasIndex(x => new { x.ItemId, x.ArchivedAt });
        });

        modelBuilder.Entity<PriceObservation>(entity =>
        {
            entity.ToTable("price_history", table =>
            {
                table.HasCheckConstraint(
                    "ck_price_history_price_nonnegative",
                    "price >= 0");
                table.HasCheckConstraint(
                    "ck_price_history_quantity_positive",
                    "quantity > 0");
            });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Price)
                .HasPrecision(18, 4);

            entity.Property(x => x.Quantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql("price / quantity", stored: true);

            entity.Property(x => x.Origin)
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(x => x.ObservedAt)
                .HasColumnName("recorded_at");

            entity.HasOne(x => x.Source)
                .WithMany()
                .HasForeignKey(x => new { x.ItemId, x.SourceId })
                .HasPrincipalKey(x => new { x.ItemId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.ScrapeResult)
                .WithMany()
                .HasForeignKey(x => x.ScrapeResultId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => new { x.ItemId, x.ObservedAt });
            entity.HasIndex(x => new { x.SourceId, x.ObservedAt });

            entity.HasIndex(x => x.ScrapeResultId)
                .IsUnique()
                .HasFilter("scrape_result_id IS NOT NULL");
        });

        modelBuilder.Entity<BestPriceState>(entity =>
        {
            entity.ToTable("best_price_states", table =>
            {
                table.HasCheckConstraint(
                    "ck_best_price_states_unit_price_nonnegative",
                    "unit_price >= 0");
            });

            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.ItemId, x.Id });

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 6);

            entity.Property(x => x.Cause)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.HasIndex(x => new { x.ItemId, x.RecordedAt });
        });

        modelBuilder.Entity<BestPriceStateSource>(entity =>
        {
            entity.ToTable("best_price_state_sources");

            entity.HasKey(x => new { x.BestPriceStateId, x.SourceId });

            entity.HasOne(x => x.BestPriceState)
                .WithMany(x => x.Sources)
                .HasForeignKey(x => new { x.ItemId, x.BestPriceStateId })
                .HasPrincipalKey(x => new { x.ItemId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Source)
                .WithMany()
                .HasForeignKey(x => new { x.ItemId, x.SourceId })
                .HasPrincipalKey(x => new { x.ItemId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => new { x.ItemId, x.SourceId });
        });

        modelBuilder.Entity<ScrapeRun>(entity =>
        {
            entity.ToTable("scrape_runs");
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.HasMany(x => x.Results)
                .WithOne(x => x.Run)
                .HasForeignKey(x => x.RunId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.StartedAt);
        });

        modelBuilder.Entity<ScrapeResult>(entity =>
        {
            entity.ToTable("scrape_results", table =>
            {
                table.HasCheckConstraint(
                    "ck_scrape_results_scraped_price_nonnegative",
                    "scraped_price IS NULL OR scraped_price >= 0");
                table.HasCheckConstraint(
                    "ck_scrape_results_scraped_quantity_positive",
                    "scraped_quantity IS NULL OR scraped_quantity > 0");
            });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.ResultStatus)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.Property(x => x.ReviewStatus)
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.Property(x => x.ScrapedPrice)
                .HasPrecision(18, 4);

            entity.Property(x => x.ScrapedQuantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.ScrapedUnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    """
                    CASE
                        WHEN scraped_price IS NULL
                          OR scraped_quantity IS NULL
                        THEN NULL
                        ELSE scraped_price / scraped_quantity
                    END
                    """,
                    stored: true);

            entity.HasOne(x => x.Item)
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Source)
                .WithMany()
                .HasForeignKey(x => new { x.ItemId, x.SourceId })
                .HasPrincipalKey(x => new { x.ItemId, x.Id })
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.RunId);
            entity.HasIndex(x => new { x.RunId, x.SourceId }).IsUnique();
            entity.HasIndex(x => x.ItemId);
            entity.HasIndex(x => new { x.ItemId, x.ReviewStatus });
        });

        modelBuilder.Entity<PriceAlertEvent>(entity =>
        {
            entity.ToTable("price_alert_events", table =>
            {
                table.HasCheckConstraint(
                    "ck_price_alert_events_unit_price_nonnegative",
                    "unit_price >= 0");
                table.HasCheckConstraint(
                    "ck_price_alert_events_target_unit_price_nonnegative",
                    "target_unit_price >= 0");
            });

            entity.HasKey(x => x.Id);

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 6);

            entity.Property(x => x.TargetUnitPrice)
                .HasPrecision(18, 6);

            entity.Property(x => x.Status)
                .HasConversion<string>()
                .HasMaxLength(20);

            entity.HasOne(x => x.Item)
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.BestPriceState)
                .WithMany()
                .HasForeignKey(x => new { x.ItemId, x.BestPriceStateId })
                .HasPrincipalKey(x => new { x.ItemId, x.Id })
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.BestPriceStateId)
                .IsUnique();
        });
    }

    private static void ConfigureComputedPrice(
        Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<decimal?> price,
        Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<decimal?> quantity,
        Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<decimal?> unitPrice,
        string priceColumn,
        string quantityColumn)
    {
        price.HasPrecision(18, 4);
        quantity.HasPrecision(18, 4);
        unitPrice
            .HasPrecision(18, 6)
            .HasComputedColumnSql(
                $"CASE WHEN {priceColumn} IS NULL OR {quantityColumn} IS NULL THEN NULL ELSE {priceColumn} / {quantityColumn} END",
                stored: true);
    }
}
