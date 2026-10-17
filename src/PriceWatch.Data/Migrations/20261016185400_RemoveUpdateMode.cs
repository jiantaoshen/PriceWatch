using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PriceWatch.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUpdateMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "update_mode",
                table: "tracked_items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "update_mode",
                table: "tracked_items",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");
        }
    }
}
