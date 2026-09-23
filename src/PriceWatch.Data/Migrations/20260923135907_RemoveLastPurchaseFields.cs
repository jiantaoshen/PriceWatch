using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLastPurchaseFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "last_purchase_date",
                table: "tracked_items");

            migrationBuilder.DropColumn(
                name: "last_purchase_price",
                table: "tracked_items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "last_purchase_date",
                table: "tracked_items",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "last_purchase_price",
                table: "tracked_items",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);
        }
    }
}
