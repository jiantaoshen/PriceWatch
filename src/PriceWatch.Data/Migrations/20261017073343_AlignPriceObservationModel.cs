using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class AlignPriceObservationModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop foreign keys/indexes that are replaced by composite item/source
            // relationships or by the new BestPriceState alert relationship.
            migrationBuilder.DropForeignKey(
                name: "fk_price_alert_events_price_history_price_history_id",
                table: "price_alert_events");

            migrationBuilder.DropForeignKey(
                name: "fk_price_history_item_sources_source_id",
                table: "price_history");

            migrationBuilder.DropForeignKey(
                name: "fk_scrape_results_item_sources_source_id",
                table: "scrape_results");

            migrationBuilder.DropForeignKey(
                name: "fk_tracked_items_item_sources_current_source_id",
                table: "tracked_items");

            migrationBuilder.DropForeignKey(
                name: "fk_tracked_items_item_sources_previous_source_id",
                table: "tracked_items");

            migrationBuilder.DropIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results");

            migrationBuilder.DropIndex(
                name: "ix_scrape_results_source_id",
                table: "scrape_results");

            migrationBuilder.DropIndex(
                name: "ix_price_history_source_id",
                table: "price_history");

            // New columns are nullable first so existing data can be backfilled safely.
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "observed_at",
                table: "scrape_results",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "archived_at",
                table: "item_sources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "best_price_state_id",
                table: "price_alert_events",
                type: "bigint",
                nullable: true);

            // Composite FKs use (item_id, source_id) so a row cannot point to a
            // source owned by a different product.
            migrationBuilder.AddUniqueConstraint(
                name: "ak_item_sources_item_id_id",
                table: "item_sources",
                columns: new[] { "item_id", "id" });

            migrationBuilder.CreateTable(
                name: "best_price_states",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation(
                            "Npgsql:ValueGenerationStrategy",
                            NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    unit_price = table.Column<decimal>(
                        type: "numeric(18,6)",
                        precision: 18,
                        scale: 6,
                        nullable: false),
                    cause = table.Column<string>(
                        type: "character varying(20)",
                        maxLength: 20,
                        nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(
                        type: "timestamp with time zone",
                        nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_best_price_states", x => x.id);
                    table.UniqueConstraint(
                        "ak_best_price_states_item_id_id",
                        x => new { x.item_id, x.id });
                    table.CheckConstraint(
                        "ck_best_price_states_unit_price_nonnegative",
                        "unit_price >= 0");
                    table.ForeignKey(
                        name: "fk_best_price_states_tracked_items_item_id",
                        column: x => x.item_id,
                        principalTable: "tracked_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "best_price_state_sources",
                columns: table => new
                {
                    best_price_state_id = table.Column<long>(
                        type: "bigint",
                        nullable: false),
                    source_id = table.Column<long>(
                        type: "bigint",
                        nullable: false),
                    item_id = table.Column<Guid>(
                        type: "uuid",
                        nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "pk_best_price_state_sources",
                        x => new { x.best_price_state_id, x.source_id });

                    table.ForeignKey(
                        name: "fk_best_price_state_sources_best_price_states_item_id_best_pri",
                        columns: x => new { x.item_id, x.best_price_state_id },
                        principalTable: "best_price_states",
                        principalColumns: new[] { "item_id", "id" },
                        onDelete: ReferentialAction.Cascade);

                    table.ForeignKey(
                        name: "fk_best_price_state_sources_item_sources_item_id_source_id",
                        columns: x => new { x.item_id, x.source_id },
                        principalTable: "item_sources",
                        principalColumns: new[] { "item_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            // -----------------------------------------------------------------
            // 1. Backfill timestamps and normalize legacy origin values.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                UPDATE scrape_results
                SET observed_at = created_at
                WHERE observed_at IS NULL;

                UPDATE price_history
                SET origin = 'Manual'
                WHERE origin = 'ManualOverride';
                """);

            // -----------------------------------------------------------------
            // 2. Repair legacy nullable source_id values only when there is a
            //    trustworthy relationship to infer from.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                UPDATE scrape_results sr
                SET source_id = ph.source_id
                FROM price_history ph
                WHERE sr.source_id IS NULL
                  AND ph.scrape_result_id = sr.id
                  AND ph.source_id IS NOT NULL;

                UPDATE price_history ph
                SET source_id = sr.source_id
                FROM scrape_results sr
                WHERE ph.source_id IS NULL
                  AND ph.scrape_result_id = sr.id
                  AND sr.source_id IS NOT NULL;
                """);

            // -----------------------------------------------------------------
            // 3. Backfill append-only observations from accepted scrape results.
            //    Old PriceHistory only contained a subset of accepted results.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                INSERT INTO price_history
                    (item_id, source_id, scrape_result_id, price, quantity, origin, recorded_at)
                SELECT
                    sr.item_id,
                    sr.source_id,
                    sr.id,
                    sr.scraped_price,
                    sr.scraped_quantity,
                    'Scrape',
                    sr.created_at
                FROM scrape_results sr
                WHERE sr.source_id IS NOT NULL
                  AND sr.scraped_price IS NOT NULL
                  AND sr.scraped_quantity IS NOT NULL
                  AND sr.scraped_price >= 0
                  AND sr.scraped_quantity > 0
                  AND sr.result_status IN ('Success', 'Suspicious')
                  AND sr.review_status IN ('NotRequired', 'Accepted')
                  AND NOT EXISTS (
                      SELECT 1
                      FROM price_history ph
                      WHERE ph.scrape_result_id = sr.id
                  );
                """);

            // Old ManualOverride reviews stored their replacement price directly
            // on ScrapeResult. Preserve any value that was not already written to
            // PriceHistory as a Manual observation.
            migrationBuilder.Sql(
                """
                INSERT INTO price_history
                    (item_id, source_id, scrape_result_id, price, quantity, origin, recorded_at)
                SELECT
                    sr.item_id,
                    sr.source_id,
                    sr.id,
                    sr.manual_price,
                    sr.manual_quantity,
                    'Manual',
                    COALESCE(sr.reviewed_at, sr.created_at)
                FROM scrape_results sr
                WHERE sr.source_id IS NOT NULL
                  AND sr.review_status = 'ManualOverride'
                  AND sr.manual_price IS NOT NULL
                  AND sr.manual_quantity IS NOT NULL
                  AND sr.manual_price >= 0
                  AND sr.manual_quantity > 0
                  AND NOT EXISTS (
                      SELECT 1
                      FROM price_history ph
                      WHERE ph.scrape_result_id = sr.id
                  );
                """);

            // Old ItemSource.ManualPrice represented the current manually entered
            // value for that source. Convert it to an append-only Manual
            // observation before the column is removed.
            //
            // Do not add a duplicate if the latest existing observation already
            // represents the same manual price/quantity.
            migrationBuilder.Sql(
                """
                INSERT INTO price_history
                    (item_id, source_id, scrape_result_id, price, quantity, origin, recorded_at)
                SELECT
                    s.item_id,
                    s.id,
                    NULL,
                    s.manual_price,
                    s.default_quantity,
                    'Manual',
                    COALESCE(s.updated_at, s.created_at, CURRENT_TIMESTAMP)
                FROM item_sources s
                LEFT JOIN LATERAL (
                    SELECT
                        ph.id,
                        ph.price,
                        ph.quantity,
                        ph.origin
                    FROM price_history ph
                    WHERE ph.item_id = s.item_id
                      AND ph.source_id = s.id
                    ORDER BY ph.recorded_at DESC, ph.id DESC
                    LIMIT 1
                ) latest ON TRUE
                WHERE s.manual_price IS NOT NULL
                  AND s.manual_price >= 0
                  AND s.default_quantity > 0
                  AND (
                      latest.id IS NULL
                      OR latest.origin <> 'Manual'
                      OR latest.price IS DISTINCT FROM s.manual_price
                      OR latest.quantity IS DISTINCT FROM s.default_quantity
                  );
                """);

            // -----------------------------------------------------------------
            // 4. Refuse to invent source IDs or silently corrupt legacy rows.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                DO $$
                DECLARE
                    missing_scrape_sources bigint;
                    missing_observation_sources bigint;
                    mismatched_scrape_sources bigint;
                    mismatched_observation_sources bigint;
                    duplicate_run_sources bigint;
                BEGIN
                    SELECT COUNT(*)
                    INTO missing_scrape_sources
                    FROM scrape_results
                    WHERE source_id IS NULL;

                    IF missing_scrape_sources > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % scrape_results rows still have NULL source_id. Fix those rows in Neon before re-running the migration.',
                            missing_scrape_sources;
                    END IF;

                    SELECT COUNT(*)
                    INTO missing_observation_sources
                    FROM price_history
                    WHERE source_id IS NULL;

                    IF missing_observation_sources > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % price_history rows still have NULL source_id. Fix those rows in Neon before re-running the migration.',
                            missing_observation_sources;
                    END IF;

                    SELECT COUNT(*)
                    INTO mismatched_scrape_sources
                    FROM scrape_results sr
                    LEFT JOIN item_sources s
                      ON s.id = sr.source_id
                     AND s.item_id = sr.item_id
                    WHERE s.id IS NULL;

                    IF mismatched_scrape_sources > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % scrape_results rows reference a source owned by another/missing item.',
                            mismatched_scrape_sources;
                    END IF;

                    SELECT COUNT(*)
                    INTO mismatched_observation_sources
                    FROM price_history ph
                    LEFT JOIN item_sources s
                      ON s.id = ph.source_id
                     AND s.item_id = ph.item_id
                    WHERE s.id IS NULL;

                    IF mismatched_observation_sources > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % price_history rows reference a source owned by another/missing item.',
                            mismatched_observation_sources;
                    END IF;

                    SELECT COUNT(*)
                    INTO duplicate_run_sources
                    FROM (
                        SELECT run_id, source_id
                        FROM scrape_results
                        GROUP BY run_id, source_id
                        HAVING COUNT(*) > 1
                    ) duplicates;

                    IF duplicate_run_sources > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % duplicate (run_id, source_id) groups exist in scrape_results.',
                            duplicate_run_sources;
                    END IF;
                END
                $$;
                """);

            // -----------------------------------------------------------------
            // 5. Reconstruct Product Best Price State history from the complete
            //    append-only source observation timeline.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                CREATE TEMP TABLE _pw_best_state_backfill
                ON COMMIT DROP
                AS
                WITH observations AS (
                    SELECT
                        ph.id AS event_id,
                        ph.item_id,
                        ph.source_id,
                        ph.recorded_at AS observed_at,
                        CASE
                            WHEN sr.review_status = 'Accepted'
                                 AND sr.reviewed_at IS NOT NULL
                                THEN sr.reviewed_at
                            ELSE ph.recorded_at
                        END AS effective_at,
                        ph.price / ph.quantity AS unit_price,
                        ph.origin,
                        sr.review_status
                    FROM price_history ph
                    LEFT JOIN scrape_results sr
                      ON sr.id = ph.scrape_result_id
                    WHERE ph.quantity > 0
                      AND ph.price >= 0
                ),
                state_at_event AS (
                    SELECT
                        e.event_id,
                        e.item_id,
                        e.effective_at AS recorded_at,
                        e.origin,
                        e.review_status,
                        current_state.unit_price,
                        current_state.source_ids
                    FROM observations e
                    CROSS JOIN LATERAL (
                        WITH latest_per_source AS (
                            SELECT DISTINCT ON (o.source_id)
                                o.source_id,
                                o.unit_price
                            FROM observations o
                            WHERE o.item_id = e.item_id
                              AND (
                                  o.effective_at < e.effective_at
                                  OR (
                                      o.effective_at = e.effective_at
                                      AND o.event_id <= e.event_id
                                  )
                              )
                            ORDER BY
                                o.source_id,
                                o.observed_at DESC,
                                o.event_id DESC
                        ),
                        minimum_price AS (
                            SELECT MIN(unit_price) AS unit_price
                            FROM latest_per_source
                        )
                        SELECT
                            mp.unit_price,
                            ARRAY(
                                SELECT lps.source_id
                                FROM latest_per_source lps
                                WHERE lps.unit_price = mp.unit_price
                                ORDER BY lps.source_id
                            )::bigint[] AS source_ids
                        FROM minimum_price mp
                    ) current_state
                ),
                compared AS (
                    SELECT
                        sae.*,
                        LAG(sae.unit_price) OVER (
                            PARTITION BY sae.item_id
                            ORDER BY sae.recorded_at, sae.event_id
                        ) AS previous_unit_price,
                        LAG(sae.source_ids) OVER (
                            PARTITION BY sae.item_id
                            ORDER BY sae.recorded_at, sae.event_id
                        ) AS previous_source_ids
                    FROM state_at_event sae
                ),
                changes AS (
                    SELECT
                        c.event_id,
                        c.item_id,
                        c.recorded_at,
                        c.unit_price,
                        c.source_ids,
                        CASE
                            WHEN c.origin = 'Manual' THEN 'Manual'
                            WHEN c.review_status = 'Accepted' THEN 'Review'
                            ELSE 'Automatic'
                        END AS cause
                    FROM compared c
                    WHERE c.previous_unit_price IS NULL
                       OR c.unit_price IS DISTINCT FROM c.previous_unit_price
                       OR c.source_ids IS DISTINCT FROM c.previous_source_ids
                )
                SELECT
                    nextval(pg_get_serial_sequence('best_price_states', 'id'))::bigint
                        AS best_price_state_id,
                    event_id,
                    item_id,
                    unit_price,
                    cause,
                    recorded_at,
                    source_ids
                FROM changes
                ORDER BY item_id, recorded_at, event_id;

                INSERT INTO best_price_states
                    (id, item_id, unit_price, cause, recorded_at)
                SELECT
                    best_price_state_id,
                    item_id,
                    unit_price,
                    cause,
                    recorded_at
                FROM _pw_best_state_backfill
                ORDER BY item_id, recorded_at, event_id;

                INSERT INTO best_price_state_sources
                    (best_price_state_id, source_id, item_id)
                SELECT
                    b.best_price_state_id,
                    source_id,
                    b.item_id
                FROM _pw_best_state_backfill b
                CROSS JOIN LATERAL unnest(b.source_ids) AS source_id;
                """);

            // -----------------------------------------------------------------
            // 6. Map legacy PriceAlertEvent rows to the reconstructed Best Price
            //    State history before removing price_history_id.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                UPDATE price_alert_events pae
                SET best_price_state_id = COALESCE(
                    (
                        SELECT b.best_price_state_id
                        FROM _pw_best_state_backfill b
                        WHERE b.item_id = pae.item_id
                          AND b.event_id = pae.price_history_id
                          AND b.unit_price = pae.unit_price
                        LIMIT 1
                    ),
                    (
                        SELECT b.best_price_state_id
                        FROM _pw_best_state_backfill b
                        JOIN price_history ph
                          ON ph.id = pae.price_history_id
                        LEFT JOIN scrape_results sr
                          ON sr.id = ph.scrape_result_id
                        WHERE b.item_id = pae.item_id
                          AND b.unit_price = pae.unit_price
                          AND b.recorded_at <=
                              CASE
                                  WHEN sr.review_status = 'Accepted'
                                       AND sr.reviewed_at IS NOT NULL
                                      THEN sr.reviewed_at
                                  ELSE ph.recorded_at
                              END
                        ORDER BY
                            b.recorded_at DESC,
                            b.event_id DESC
                        LIMIT 1
                    )
                )
                WHERE pae.best_price_state_id IS NULL;

                DO $$
                DECLARE
                    unmapped_alerts bigint;
                    duplicate_alert_states bigint;
                BEGIN
                    SELECT COUNT(*)
                    INTO unmapped_alerts
                    FROM price_alert_events
                    WHERE best_price_state_id IS NULL;

                    IF unmapped_alerts > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % legacy price_alert_events could not be mapped to a BestPriceState.',
                            unmapped_alerts;
                    END IF;

                    SELECT COUNT(*)
                    INTO duplicate_alert_states
                    FROM (
                        SELECT best_price_state_id
                        FROM price_alert_events
                        GROUP BY best_price_state_id
                        HAVING COUNT(*) > 1
                    ) duplicates;

                    IF duplicate_alert_states > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel: % BestPriceState values map to multiple legacy alert rows. Resolve duplicate historical alerts before re-running.',
                            duplicate_alert_states;
                    END IF;
                END
                $$;
                """);

            // -----------------------------------------------------------------
            // 7. Recalculate each product's current summary from every active
            //    source's latest effective observation.
            // -----------------------------------------------------------------
            migrationBuilder.Sql(
                """
                WITH latest_per_source AS (
                    SELECT DISTINCT ON (ph.item_id, ph.source_id)
                        ph.item_id,
                        ph.source_id,
                        ph.price,
                        ph.quantity,
                        ph.recorded_at,
                        ph.price / ph.quantity AS unit_price
                    FROM price_history ph
                    JOIN item_sources s
                      ON s.id = ph.source_id
                     AND s.item_id = ph.item_id
                    WHERE s.archived_at IS NULL
                    ORDER BY
                        ph.item_id,
                        ph.source_id,
                        ph.recorded_at DESC,
                        ph.id DESC
                ),
                minimum_by_item AS (
                    SELECT
                        item_id,
                        MIN(unit_price) AS unit_price
                    FROM latest_per_source
                    GROUP BY item_id
                ),
                representative_best AS (
                    SELECT DISTINCT ON (lps.item_id)
                        lps.item_id,
                        lps.price,
                        lps.quantity
                    FROM latest_per_source lps
                    JOIN minimum_by_item minimum
                      ON minimum.item_id = lps.item_id
                     AND minimum.unit_price = lps.unit_price
                    ORDER BY
                        lps.item_id,
                        lps.source_id
                ),
                best_observed AS (
                    SELECT
                        lps.item_id,
                        MAX(lps.recorded_at) AS observed_at
                    FROM latest_per_source lps
                    JOIN minimum_by_item minimum
                      ON minimum.item_id = lps.item_id
                     AND minimum.unit_price = lps.unit_price
                    GROUP BY lps.item_id
                )
                UPDATE tracked_items ti
                SET
                    current_price = rb.price,
                    current_quantity = rb.quantity,
                    last_successful_price_at = bo.observed_at,
                    updated_at = CURRENT_TIMESTAMP
                FROM representative_best rb
                JOIN best_observed bo
                  ON bo.item_id = rb.item_id
                WHERE ti.id = rb.item_id;

                UPDATE tracked_items ti
                SET
                    current_price = NULL,
                    current_quantity = NULL,
                    last_successful_price_at = NULL,
                    last_price_changed_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM price_history ph
                    JOIN item_sources s
                      ON s.id = ph.source_id
                     AND s.item_id = ph.item_id
                    WHERE ph.item_id = ti.id
                      AND s.archived_at IS NULL
                );

                WITH ordered_states AS (
                    SELECT
                        id,
                        item_id,
                        recorded_at,
                        unit_price,
                        LAG(unit_price) OVER (
                            PARTITION BY item_id
                            ORDER BY recorded_at, id
                        ) AS previous_unit_price
                    FROM best_price_states
                ),
                last_price_change AS (
                    SELECT DISTINCT ON (item_id)
                        item_id,
                        recorded_at
                    FROM ordered_states
                    WHERE previous_unit_price IS NULL
                       OR unit_price IS DISTINCT FROM previous_unit_price
                    ORDER BY
                        item_id,
                        recorded_at DESC,
                        id DESC
                )
                UPDATE tracked_items ti
                SET last_price_changed_at = price_change.recorded_at
                FROM last_price_change price_change
                WHERE ti.id = price_change.item_id;
                """);

            // -----------------------------------------------------------------
            // 8. Tighten nullability only after data is safe.
            // -----------------------------------------------------------------
            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "observed_at",
                table: "scrape_results",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "source_id",
                table: "scrape_results",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "source_id",
                table: "price_history",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "best_price_state_id",
                table: "price_alert_events",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            // -----------------------------------------------------------------
            // 9. Create the new indexes and foreign keys.
            // -----------------------------------------------------------------
            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_item_id_source_id",
                table: "scrape_results",
                columns: new[] { "item_id", "source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results",
                columns: new[] { "run_id", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_price_history_item_id_source_id",
                table: "price_history",
                columns: new[] { "item_id", "source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_price_history_source_id_recorded_at",
                table: "price_history",
                columns: new[] { "source_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "ix_item_sources_item_id_archived_at",
                table: "item_sources",
                columns: new[] { "item_id", "archived_at" });

            migrationBuilder.CreateIndex(
                name: "ix_best_price_state_sources_item_id_best_price_state_id",
                table: "best_price_state_sources",
                columns: new[] { "item_id", "best_price_state_id" });

            migrationBuilder.CreateIndex(
                name: "ix_best_price_state_sources_item_id_source_id",
                table: "best_price_state_sources",
                columns: new[] { "item_id", "source_id" });

            migrationBuilder.CreateIndex(
                name: "ix_best_price_states_item_id_recorded_at",
                table: "best_price_states",
                columns: new[] { "item_id", "recorded_at" });

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_best_price_state_id",
                table: "price_alert_events",
                column: "best_price_state_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_item_id_best_price_state_id",
                table: "price_alert_events",
                columns: new[] { "item_id", "best_price_state_id" });

            migrationBuilder.AddForeignKey(
                name: "fk_price_alert_events_best_price_states_item_id_best_price_sta",
                table: "price_alert_events",
                columns: new[] { "item_id", "best_price_state_id" },
                principalTable: "best_price_states",
                principalColumns: new[] { "item_id", "id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_price_history_item_sources_item_id_source_id",
                table: "price_history",
                columns: new[] { "item_id", "source_id" },
                principalTable: "item_sources",
                principalColumns: new[] { "item_id", "id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_scrape_results_item_sources_item_id_source_id",
                table: "scrape_results",
                columns: new[] { "item_id", "source_id" },
                principalTable: "item_sources",
                principalColumns: new[] { "item_id", "id" },
                onDelete: ReferentialAction.Restrict);

            // -----------------------------------------------------------------
            // 10. Remove legacy columns only after all data has been migrated.
            // -----------------------------------------------------------------
            migrationBuilder.DropIndex(
                name: "ix_price_alert_events_price_history_id",
                table: "price_alert_events");

            migrationBuilder.DropIndex(
                name: "ix_price_alert_events_item_id",
                table: "price_alert_events");

            migrationBuilder.DropColumn(
                name: "price_history_id",
                table: "price_alert_events");

            migrationBuilder.DropIndex(
                name: "ix_tracked_items_current_source_id",
                table: "tracked_items");

            migrationBuilder.DropIndex(
                name: "ix_tracked_items_previous_source_id",
                table: "tracked_items");

            migrationBuilder.DropColumn(
                name: "current_source_id",
                table: "tracked_items");

            migrationBuilder.DropColumn(
                name: "previous_source_id",
                table: "tracked_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_manual_price_nonnegative",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_scrape_results_manual_quantity_positive",
                table: "scrape_results");

            migrationBuilder.DropColumn(
                name: "manual_unit_price",
                table: "scrape_results");

            migrationBuilder.DropColumn(
                name: "manual_price",
                table: "scrape_results");

            migrationBuilder.DropColumn(
                name: "manual_quantity",
                table: "scrape_results");

            migrationBuilder.DropCheckConstraint(
                name: "ck_item_sources_manual_price_nonnegative",
                table: "item_sources");

            migrationBuilder.DropColumn(
                name: "manual_price",
                table: "item_sources");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Rollback restores the legacy schema as faithfully as possible.
            // BestPriceState history has no exact one-column legacy equivalent,
            // so tied-source information cannot be represented after downgrade.

            migrationBuilder.DropForeignKey(
                name: "fk_price_alert_events_best_price_states_item_id_best_price_sta",
                table: "price_alert_events");

            migrationBuilder.DropForeignKey(
                name: "fk_price_history_item_sources_item_id_source_id",
                table: "price_history");

            migrationBuilder.DropForeignKey(
                name: "fk_scrape_results_item_sources_item_id_source_id",
                table: "scrape_results");

            migrationBuilder.AddColumn<long>(
                name: "price_history_id",
                table: "price_alert_events",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "current_source_id",
                table: "tracked_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "previous_source_id",
                table: "tracked_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_price",
                table: "scrape_results",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_quantity",
                table: "scrape_results",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_unit_price",
                table: "scrape_results",
                type: "numeric(18,6)",
                precision: 18,
                scale: 6,
                nullable: true,
                computedColumnSql:
                    "CASE WHEN manual_price IS NULL OR manual_quantity IS NULL THEN NULL ELSE manual_price / manual_quantity END",
                stored: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_price",
                table: "item_sources",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            // Map each alert back to one observation from its BestPriceState.
            migrationBuilder.Sql(
                """
                UPDATE price_alert_events pae
                SET price_history_id = (
                    SELECT ph.id
                    FROM best_price_states bps
                    JOIN best_price_state_sources bpss
                      ON bpss.best_price_state_id = bps.id
                     AND bpss.item_id = bps.item_id
                    JOIN price_history ph
                      ON ph.item_id = bps.item_id
                     AND ph.source_id = bpss.source_id
                    WHERE bps.id = pae.best_price_state_id
                      AND ph.recorded_at <= bps.recorded_at
                      AND (ph.price / ph.quantity) = bps.unit_price
                    ORDER BY ph.recorded_at DESC, ph.id DESC
                    LIMIT 1
                )
                WHERE pae.price_history_id IS NULL;
                """);

            // Restore ItemSource.ManualPrice from the latest manual observation.
            migrationBuilder.Sql(
                """
                UPDATE item_sources s
                SET manual_price = (
                    SELECT ph.price
                    FROM price_history ph
                    WHERE ph.item_id = s.item_id
                      AND ph.source_id = s.id
                      AND ph.origin = 'Manual'
                    ORDER BY ph.recorded_at DESC, ph.id DESC
                    LIMIT 1
                );
                """);

            // Restore legacy ScrapeResult manual override fields when a nearby
            // manual observation can be identified for the same source.
            migrationBuilder.Sql(
                """
                UPDATE scrape_results sr
                SET
                    manual_price = (
                        SELECT ph.price
                        FROM price_history ph
                        WHERE ph.item_id = sr.item_id
                          AND ph.source_id = sr.source_id
                          AND ph.origin = 'Manual'
                        ORDER BY
                            ABS(EXTRACT(EPOCH FROM (
                                ph.recorded_at - COALESCE(sr.reviewed_at, sr.created_at)
                            ))),
                            ph.id DESC
                        LIMIT 1
                    ),
                    manual_quantity = (
                        SELECT ph.quantity
                        FROM price_history ph
                        WHERE ph.item_id = sr.item_id
                          AND ph.source_id = sr.source_id
                          AND ph.origin = 'Manual'
                        ORDER BY
                            ABS(EXTRACT(EPOCH FROM (
                                ph.recorded_at - COALESCE(sr.reviewed_at, sr.created_at)
                            ))),
                            ph.id DESC
                        LIMIT 1
                    )
                WHERE sr.review_status = 'ManualOverride';
                """);

            // Restore one representative current source from the latest state.
            migrationBuilder.Sql(
                """
                UPDATE tracked_items ti
                SET current_source_id = (
                    SELECT MIN(bpss.source_id)
                    FROM best_price_state_sources bpss
                    WHERE bpss.item_id = ti.id
                      AND bpss.best_price_state_id = (
                          SELECT bps.id
                          FROM best_price_states bps
                          WHERE bps.item_id = ti.id
                          ORDER BY bps.recorded_at DESC, bps.id DESC
                          LIMIT 1
                      )
                );

                UPDATE tracked_items ti
                SET previous_source_id = (
                    SELECT MIN(bpss.source_id)
                    FROM best_price_state_sources bpss
                    WHERE bpss.item_id = ti.id
                      AND bpss.best_price_state_id = (
                          SELECT bps.id
                          FROM best_price_states bps
                          WHERE bps.item_id = ti.id
                          ORDER BY bps.recorded_at DESC, bps.id DESC
                          OFFSET 1
                          LIMIT 1
                      )
                );
                """);

            migrationBuilder.DropIndex(
                name: "ix_price_alert_events_best_price_state_id",
                table: "price_alert_events");

            migrationBuilder.DropIndex(
                name: "ix_price_alert_events_item_id_best_price_state_id",
                table: "price_alert_events");

            migrationBuilder.DropIndex(
                name: "ix_price_history_item_id_source_id",
                table: "price_history");

            migrationBuilder.DropIndex(
                name: "ix_price_history_source_id_recorded_at",
                table: "price_history");

            migrationBuilder.DropIndex(
                name: "ix_scrape_results_item_id_source_id",
                table: "scrape_results");

            migrationBuilder.DropIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results");

            migrationBuilder.DropIndex(
                name: "ix_item_sources_item_id_archived_at",
                table: "item_sources");

            migrationBuilder.DropTable(
                name: "best_price_state_sources");

            migrationBuilder.DropTable(
                name: "best_price_states");

            migrationBuilder.DropUniqueConstraint(
                name: "ak_item_sources_item_id_id",
                table: "item_sources");

            migrationBuilder.AlterColumn<long>(
                name: "source_id",
                table: "scrape_results",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<long>(
                name: "source_id",
                table: "price_history",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.DropColumn(
                name: "observed_at",
                table: "scrape_results");

            migrationBuilder.DropColumn(
                name: "archived_at",
                table: "item_sources");

            migrationBuilder.DropColumn(
                name: "best_price_state_id",
                table: "price_alert_events");

            migrationBuilder.Sql(
                """
                DO $$
                DECLARE
                    unmapped_alerts bigint;
                BEGIN
                    SELECT COUNT(*)
                    INTO unmapped_alerts
                    FROM price_alert_events
                    WHERE price_history_id IS NULL;

                    IF unmapped_alerts > 0 THEN
                        RAISE EXCEPTION
                            'AlignPriceObservationModel DOWN: % alerts cannot be mapped back to PriceHistory.',
                            unmapped_alerts;
                    END IF;
                END
                $$;
                """);

            migrationBuilder.AlterColumn<long>(
                name: "price_history_id",
                table: "price_alert_events",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_current_source_id",
                table: "tracked_items",
                column: "current_source_id");

            migrationBuilder.CreateIndex(
                name: "ix_tracked_items_previous_source_id",
                table: "tracked_items",
                column: "previous_source_id");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_run_id_source_id",
                table: "scrape_results",
                columns: new[] { "run_id", "source_id" },
                unique: true,
                filter: "source_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_scrape_results_source_id",
                table: "scrape_results",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_history_source_id",
                table: "price_history",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_price_history_id",
                table: "price_alert_events",
                column: "price_history_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_price_alert_events_item_id",
                table: "price_alert_events",
                column: "item_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_manual_price_nonnegative",
                table: "scrape_results",
                sql: "manual_price IS NULL OR manual_price >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_scrape_results_manual_quantity_positive",
                table: "scrape_results",
                sql: "manual_quantity IS NULL OR manual_quantity > 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_item_sources_manual_price_nonnegative",
                table: "item_sources",
                sql: "manual_price IS NULL OR manual_price >= 0");

            migrationBuilder.AddForeignKey(
                name: "fk_price_alert_events_price_history_price_history_id",
                table: "price_alert_events",
                column: "price_history_id",
                principalTable: "price_history",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_price_history_item_sources_source_id",
                table: "price_history",
                column: "source_id",
                principalTable: "item_sources",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_scrape_results_item_sources_source_id",
                table: "scrape_results",
                column: "source_id",
                principalTable: "item_sources",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_tracked_items_item_sources_current_source_id",
                table: "tracked_items",
                column: "current_source_id",
                principalTable: "item_sources",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_tracked_items_item_sources_previous_source_id",
                table: "tracked_items",
                column: "previous_source_id",
                principalTable: "item_sources",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
