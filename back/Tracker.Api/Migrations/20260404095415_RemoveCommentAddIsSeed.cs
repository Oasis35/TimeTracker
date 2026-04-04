using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCommentAddIsSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Comment",
                table: "TimeEntries");

            migrationBuilder.AddColumn<bool>(
                name: "IsSeed",
                table: "TimeEntries",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSeed",
                table: "TimeEntries");

            migrationBuilder.AddColumn<string>(
                name: "Comment",
                table: "TimeEntries",
                type: "TEXT",
                maxLength: 500,
                nullable: true);
        }
    }
}
