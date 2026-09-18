using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "scrape_runs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    total_items = table.Column<int>(type: "integer", nullable: false),
                    successful = table.Column<int>(type: "integer", nullable: false),
                    failed = table.Column<int>(type: "integer", nullable: false),
                    suspicious = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scrape_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "item_sources",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    store = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    url = table.Column<string>(type: "text", nullable: true),
                    scraping_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    default_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_item_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tracked_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    unit = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    target_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    comparison_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    target_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true, computedColumnSql: "CASE\r\n    WHEN target_price IS NULL\r\n    THEN NULL\r\n    ELSE target_price / comparison_quantity\r\nEND", stored: true),
                    current_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    current_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    current_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true, computedColumnSql: "CASE\r\n    WHEN current_price IS NULL\r\n      OR current_quantity IS NULL\r\n    THEN NULL\r\n    ELSE current_price / current_quantity\r\nEND", stored: true),
                    current_source_id = table.Column<long>(type: "bigint", nullable: true),
                    previous_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    previous_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    previous_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true, computedColumnSql: "CASE\r\n    WHEN previous_price IS NULL\r\n      OR previous_quantity IS NULL\r\n    THEN NULL\r\n    ELSE previous_price / previous_quantity\r\nEND", stored: true),
                    previous_source_id = table.Column<long>(type: "bigint", nullable: true),
                    last_purchase_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    last_purchase_date = table.Column<DateOnly>(type: "date", nullable: true),
                    update_mode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    check_interval_minutes = table.Column<int>(type: "integer", nullable: true),
                    tracking_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    last_checked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_successful_price_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_price_changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tracked_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_tracked_items_item_sources_current_source_id",
                        column: x => x.current_source_id,
                        principalTable: "item_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_tracked_items_item_sources_previous_source_id",
                        column: x => x.previous_source_id,
                        principalTable: "item_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "scrape_results",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    run_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<long>(type: "bigint", nullable: true),
                    scraped_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    scraped_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    scraped_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true, computedColumnSql: "CASE\r\n    WHEN scraped_price IS NULL\r\n      OR scraped_quantity IS NULL\r\n    THEN NULL\r\n    ELSE scraped_price / scraped_quantity\r\nEND", stored: true),
                    result_status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    suspicious_reason = table.Column<string>(type: "text", nullable: true),
                    review_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    manual_price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    manual_quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    manual_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true, computedColumnSql: "CASE\r\n    WHEN manual_price IS NULL\r\n      OR manual_quantity IS NULL\r\n    THEN NULL\r\n    ELSE manual_price / manual_quantity\r\nEND", stored: true),
                    review_note = table.Column<string>(type: "text", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scrape_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_scrape_results_item_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "item_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_scrape_results_scrape_runs_run_id",
                        column: x => x.run_id,
                        principalTable: "scrape_runs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_scrape_results_tracked_items_item_id",
                        column: x => x.item_id,
                        principalTable: "tracked_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "price_history",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<long>(type: "bigint", nullable: true),
                    scrape_result_id = table.Column<long>(type: "bigint", nullable: true),
                    price = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false, computedColumnSql: "price / quantity", stored: true),
                    origin = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_price_history", x => x.id);
                    table.ForeignKey(
                        name: "fk_price_history_item_sources_source_id",
                        column: x => x.source_id,
                        principalTable: "item_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_price_history_scrape_results_scrape_result_id",
                        column: x => x.scrape_result_id,
                        principalTable: "scrape_results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_price_history_tracked_items_item_id",
                        column: x => x.item_id,
                        principalTable: "tracked_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "price_alert_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    price_history_id = table.Column<long>(type: "bigint", nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    target_unit_price = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_price_alert_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_price_alert_events_price_history_price_history_id",
                        column: x => x.price_history_id,
                        principalTable: "price_history",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_price_alert_events_tracked_items_item_id",
                        column: x => x.item_id,
                        principalTable: "tracked_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_item_sources_item_id",
                table: "item_sources",
                column: "item_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_item_id",
                table: "price_alert_events",
                column: "item_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_price_history_id",
                table: "price_alert_events",
                column: "price_history_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_price_history_item_id_recorded_at",
                table: "price_history",
                columns: new[] { "item_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "ix_price_history_scrape_result_id",
                table: "price_history",
                column: "scrape_result_id",
                unique: true,
                filter: "scrape_result_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_price_history_source_id",
                table: "price_history",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_item_id",
                table: "scrape_results",
                column: "item_id");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_item_id_review_status",
                table: "scrape_results",
                columns: new[] { "item_id", "review_status" });

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_run_id",
                table: "scrape_results",
                column: "run_id");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_source_id",
                table: "scrape_results",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_runs_started_at",
                table: "scrape_runs",
                column: "started_at");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_archived_at",
                table: "tracked_items",
                column: "archived_at");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_current_source_id",
                table: "tracked_items",
                column: "current_source_id");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_item_type",
                table: "tracked_items",
                column: "item_type");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_previous_source_id",
                table: "tracked_items",
                column: "previous_source_id");

            migrationBuilder.AddForeignKey(
                name: "fk_item_sources_tracked_items_item_id",
                table: "item_sources",
                column: "item_id",
                principalTable: "tracked_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_item_sources_tracked_items_item_id",
                table: "item_sources");

            migrationBuilder.DropTable(
                name: "price_alert_events");

            migrationBuilder.DropTable(
                name: "price_history");

            migrationBuilder.DropTable(
                name: "scrape_results");

            migrationBuilder.DropTable(
                name: "scrape_runs");

            migrationBuilder.DropTable(
                name: "tracked_items");

            migrationBuilder.DropTable(
                name: "item_sources");
        }
    }
}
