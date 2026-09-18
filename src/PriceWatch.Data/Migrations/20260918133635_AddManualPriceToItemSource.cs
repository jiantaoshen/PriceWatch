using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddManualPriceToItemSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "store",
                table: "item_sources",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_price",
                table: "item_sources",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "manual_price",
                table: "item_sources");

            migrationBuilder.AlterColumn<string>(
                name: "store",
                table: "item_sources",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200);
        }
    }
}
