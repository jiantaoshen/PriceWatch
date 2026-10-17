using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDataIntegrityConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_check_interval_positive",
                table: "tracked_items",
                sql: "check_interval_minutes IS NULL OR check_interval_minutes > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_comparison_quantity_positive",
                table: "tracked_items",
                sql: "comparison_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_current_price_nonnegative",
                table: "tracked_items",
                sql: "current_price IS NULL OR current_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_current_quantity_positive",
                table: "tracked_items",
                sql: "current_quantity IS NULL OR current_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_previous_price_nonnegative",
                table: "tracked_items",
                sql: "previous_price IS NULL OR previous_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_previous_quantity_positive",
                table: "tracked_items",
                sql: "previous_quantity IS NULL OR previous_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_tracked_items_target_price_nonnegative",
                table: "tracked_items",
                sql: "target_price IS NULL OR target_price >= 0");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results",
                columns: new[] { "run_id", "source_id" },
                unique: true,
                filter: "source_id IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_manual_price_nonnegative",
                table: "scrape_results",
                sql: "manual_price IS NULL OR manual_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_manual_quantity_positive",
                table: "scrape_results",
                sql: "manual_quantity IS NULL OR manual_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_scraped_price_nonnegative",
                table: "scrape_results",
                sql: "scraped_price IS NULL OR scraped_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_scraped_quantity_positive",
                table: "scrape_results",
                sql: "scraped_quantity IS NULL OR scraped_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_price_history_price_nonnegative",
                table: "price_history",
                sql: "price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_price_history_quantity_positive",
                table: "price_history",
                sql: "quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_price_alert_events_target_unit_price_nonnegative",
                table: "price_alert_events",
                sql: "target_unit_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_price_alert_events_unit_price_nonnegative",
                table: "price_alert_events",
                sql: "unit_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_item_sources_default_quantity_positive",
                table: "item_sources",
                sql: "default_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_item_sources_manual_price_nonnegative",
                table: "item_sources",
                sql: "manual_price IS NULL OR manual_price >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_check_interval_positive",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_comparison_quantity_positive",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_current_price_nonnegative",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_current_quantity_positive",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_previous_price_nonnegative",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_previous_quantity_positive",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_tracked_items_target_price_nonnegative",
                table: "tracked_items");

            migrationBuilder.DropIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_manual_price_nonnegative",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_manual_quantity_positive",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_scraped_price_nonnegative",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_scraped_quantity_positive",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_price_history_price_nonnegative",
                table: "price_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_price_history_quantity_positive",
                table: "price_history");

            migrationBuilder.DropCheckConstraint(
                name: "ck_price_alert_events_target_unit_price_nonnegative",
                table: "price_alert_events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_price_alert_events_unit_price_nonnegative",
                table: "price_alert_events");

            migrationBuilder.DropCheckConstraint(
                name: "ck_item_sources_default_quantity_positive",
                table: "item_sources");

            migrationBuilder.DropCheckConstraint(
                name: "ck_item_sources_manual_price_nonnegative",
                table: "item_sources");
        }
    }
}
