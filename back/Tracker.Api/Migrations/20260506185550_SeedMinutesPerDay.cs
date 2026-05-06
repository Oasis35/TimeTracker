using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class SeedMinutesPerDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO AppSettings (Key, Value)
                SELECT 'minutesPerDay', '420'
                WHERE NOT EXISTS (SELECT 1 FROM AppSettings WHERE Key = 'minutesPerDay');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM AppSettings WHERE Key = 'minutesPerDay';");
        }
    }
}
