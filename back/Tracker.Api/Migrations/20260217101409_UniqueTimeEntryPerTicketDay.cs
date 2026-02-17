using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class UniqueTimeEntryPerTicketDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TimeEntries_Date_TicketId",
                table: "TimeEntries");

            migrationBuilder.DropIndex(
                name: "IX_TimeEntries_TicketId",
                table: "TimeEntries");

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_TicketId_Date",
                table: "TimeEntries",
                columns: new[] { "TicketId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TimeEntries_TicketId_Date",
                table: "TimeEntries");

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_Date_TicketId",
                table: "TimeEntries",
                columns: new[] { "Date", "TicketId" });

            migrationBuilder.CreateIndex(
                name: "IX_TimeEntries_TicketId",
                table: "TimeEntries",
                column: "TicketId");
        }
    }
}
