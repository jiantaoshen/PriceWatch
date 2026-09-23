using Microsoft.EntityFrameworkCore;
using PriceWatch.Data.Entities;

namespace PriceWatch.Data;

public class PriceWatchDbContext : DbContext
{
    public PriceWatchDbContext(
        DbContextOptions<PriceWatchDbContext> options)
        : base(options)
    {
    }

    public DbSet<TrackedItem> TrackedItems => Set<TrackedItem>();

    public DbSet<ItemSource> ItemSources => Set<ItemSource>();

    public DbSet<PriceHistory> PriceHistory => Set<PriceHistory>();

    public DbSet<ScrapeRun> ScrapeRuns => Set<ScrapeRun>();

    public DbSet<ScrapeResult> ScrapeResults => Set<ScrapeResult>();

    public DbSet<PriceAlertEvent> PriceAlertEvents =>
        Set<PriceAlertEvent>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // =============================
        // TrackedItem
        // =============================

        modelBuilder.Entity<TrackedItem>(entity =>
        {
            entity.ToTable("tracked_items");

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

            entity.Property(x => x.UpdateMode)
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

            entity.Property(x => x.CurrentPrice)
                .HasPrecision(18, 4);

            entity.Property(x => x.CurrentQuantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.CurrentUnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    """
                    CASE
                        WHEN current_price IS NULL
                          OR current_quantity IS NULL
                        THEN NULL
                        ELSE current_price / current_quantity
                    END
                    """,
                    stored: true);

            entity.Property(x => x.PreviousPrice)
                .HasPrecision(18, 4);

            entity.Property(x => x.PreviousQuantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.PreviousUnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    """
                    CASE
                        WHEN previous_price IS NULL
                          OR previous_quantity IS NULL
                        THEN NULL
                        ELSE previous_price / previous_quantity
                    END
                    """,
                    stored: true);

            entity.HasMany(x => x.Sources)
                .WithOne(x => x.Item)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(x => x.PriceHistory)
                .WithOne(x => x.Item)
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.CurrentSource)
                .WithMany()
                .HasForeignKey(x => x.CurrentSourceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.PreviousSource)
                .WithMany()
                .HasForeignKey(x => x.PreviousSourceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => x.ItemType);

            entity.HasIndex(x => x.ArchivedAt);
        });


        // =============================
        // ItemSource
        // =============================

        modelBuilder.Entity<ItemSource>(entity =>
        {
            entity.ToTable("item_sources");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Store)
                .HasMaxLength(200);

            entity.Property(x => x.DefaultQuantity)
                .HasPrecision(18, 4);

            entity.HasIndex(x => x.ItemId);
        });


        // =============================
        // PriceHistory
        // =============================

        modelBuilder.Entity<PriceHistory>(entity =>
        {
            entity.ToTable("price_history");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Price)
                .HasPrecision(18, 4);

            entity.Property(x => x.Quantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    "price / quantity",
                    stored: true);

            entity.Property(x => x.Origin)
                .HasConversion<string>()
                .HasMaxLength(30);

            entity.HasOne(x => x.Source)
                .WithMany()
                .HasForeignKey(x => x.SourceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.ScrapeResult)
                .WithMany()
                .HasForeignKey(x => x.ScrapeResultId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => new
            {
                x.ItemId,
                x.RecordedAt
            });

            entity.HasIndex(x => x.ScrapeResultId)
                .IsUnique()
                .HasFilter("scrape_result_id IS NOT NULL");
        });


        // =============================
        // ScrapeRun
        // =============================

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


        // =============================
        // ScrapeResult
        // =============================

        modelBuilder.Entity<ScrapeResult>(entity =>
        {
            entity.ToTable("scrape_results");

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

            entity.Property(x => x.ManualPrice)
                .HasPrecision(18, 4);

            entity.Property(x => x.ManualQuantity)
                .HasPrecision(18, 4);

            entity.Property(x => x.ManualUnitPrice)
                .HasPrecision(18, 6)
                .HasComputedColumnSql(
                    """
                    CASE
                        WHEN manual_price IS NULL
                          OR manual_quantity IS NULL
                        THEN NULL
                        ELSE manual_price / manual_quantity
                    END
                    """,
                    stored: true);

            entity.HasOne(x => x.Item)
                .WithMany()
                .HasForeignKey(x => x.ItemId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Source)
                .WithMany()
                .HasForeignKey(x => x.SourceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(x => x.RunId);

            entity.HasIndex(x => x.ItemId);

            entity.HasIndex(x => new
            {
                x.ItemId,
                x.ReviewStatus
            });
        });


        // =============================
        // PriceAlertEvent
        // =============================

        modelBuilder.Entity<PriceAlertEvent>(entity =>
        {
            entity.ToTable("price_alert_events");

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

            entity.HasOne(x => x.PriceHistory)
                .WithMany()
                .HasForeignKey(x => x.PriceHistoryId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(x => x.PriceHistoryId)
                .IsUnique();
        });
    }
}