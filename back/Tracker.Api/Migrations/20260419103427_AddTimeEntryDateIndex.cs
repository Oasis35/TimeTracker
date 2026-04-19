using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTimeEntryDateIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_Date",
                table: "TimeEntries",
                column: "Date");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TimeEntries_Date",
                table: "TimeEntries");
        }
    }
}
